/**
 * PunditBench prediction runner (A1/A3/A4/A5).
 *
 *   npm run predict -- --stage group [--models all|id1,id2] [--mock] [--dry-run] [--only-missing]
 *
 * - One identical prompt per stage for every roster model (D4).
 * - temperature 0 where accepted; on a temperature-related 4xx the call retries
 *   without it and records that in params (D2).
 * - <=3 attempts per model, attempts 2-3 append validator errors (D5).
 * - EVERY attempt is appended to data/raw/<stage>/<slug>.jsonl — full audit trail.
 * - Valid predictions land in data/predictions/<stage>/<slug>.json.
 * - --mock produces deterministic fake predictions (pipeline test without a key).
 */
import fs from "node:fs";
import path from "node:path";
import { buildPrompt, modelSlug, PROMPT_VERSION } from "../lib/prompt";
import { validatePredictions } from "../lib/validate";
import { isKnockout } from "../lib/scoring";
import {
  fixturesByMatch,
  loadGroupOrderOverride,
  loadResults,
  loadRoster,
  loadStageFixtures,
  loadTeams,
  loadThirdOrderOverride,
} from "../lib/data";
import { groupTable } from "../lib/standings";
import type { Fixture, MatchResult, PredictionFile, RosterModel, StageId } from "../lib/types";
import { KNOCKOUT_STAGES } from "../lib/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_ATTEMPTS = 3;
const CONCURRENCY = 4;

interface Args {
  stage: StageId;
  models: string;
  mock: boolean;
  dryRun: boolean;
  onlyMissing: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const stage = (get("--stage") ?? "group") as StageId;
  if (!["group", ...KNOCKOUT_STAGES].includes(stage)) {
    console.error(`Unknown stage "${stage}".`);
    process.exit(1);
  }
  return {
    stage,
    models: get("--models") ?? "all",
    mock: argv.includes("--mock"),
    dryRun: argv.includes("--dry-run"),
    onlyMissing: argv.includes("--only-missing"),
  };
}

function loadEnv(): void {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

/** Knockout prompts include actual results so far (D4). */
function buildStagePrompt(stage: StageId, fixtures: Fixture[]): string {
  if (!isKnockout(stage)) return buildPrompt(stage, fixtures);
  const teams = loadTeams();
  const allFixtures = [...fixturesByMatch().values()];
  const results = new Map<number, MatchResult>(loadResults().map((r) => [r.match, r]));
  const groupOverride = loadGroupOrderOverride();
  const groups = [...new Set(teams.map((t) => t.group))].sort();
  const groupTables = new Map(
    groups.map((g) => [g, groupTable(g, teams, allFixtures, results, groupOverride?.[g])]),
  );
  void loadThirdOrderOverride; // thirds order only matters for bracket resolution, not prompt context
  const knockoutResults = allFixtures
    .filter((f) => isKnockout(f.stage) && results.get(f.match)?.status === "final")
    .map((f) => ({ fixture: f, result: results.get(f.match)! }));
  return buildPrompt(stage, fixtures, { groupTables, knockoutResults });
}

interface AttemptLog {
  ts: string;
  model: string;
  stage: StageId;
  attempt: number;
  prompt_version: string;
  params: Record<string, unknown>;
  request_chars: number;
  response_raw?: string;
  usage?: Record<string, unknown>;
  latency_ms?: number;
  http_status?: number;
  error?: string;
  validation_errors?: string[];
  validation_warnings?: string[];
  ok: boolean;
}

function appendRaw(stage: StageId, slug: string, entry: AttemptLog & { prompt?: string }): void {
  const dir = path.join(process.cwd(), "data", "raw", stage);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, `${slug}.jsonl`), JSON.stringify(entry) + "\n", "utf-8");
}

async function callOpenRouter(
  model: string,
  prompt: string,
  params: Record<string, unknown>,
): Promise<{ raw: string; usage?: Record<string, unknown>; status: number; latency: number }> {
  const started = Date.now();
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://punditbench.com",
      "X-Title": "PunditBench",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      usage: { include: true },
      ...params,
    }),
  });
  const latency = Date.now() - started;
  const body = await res.text();
  if (!res.ok) {
    throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 500)}`), {
      status: res.status,
      body,
      latency,
    });
  }
  const json = JSON.parse(body);
  const raw: string = json.choices?.[0]?.message?.content ?? "";
  return { raw, usage: json.usage, status: res.status, latency };
}

/** Deterministic mock predictions — no randomness, stable per (slug, match). */
function mockRaw(slug: string, fixtures: Fixture[]): string {
  const h = (s: string): number => {
    let x = 0;
    for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0;
    return x;
  };
  const predictions = fixtures.map((f) => {
    const seed = h(`${slug}:${f.match}`);
    const home_goals = seed % 4;
    const away_goals = (seed >>> 3) % 3;
    const p: Record<string, unknown> = { match: f.match, home_goals, away_goals };
    if (isKnockout(f.stage) && home_goals === away_goals) p.advances = seed % 2 ? f.home : f.away;
    return p;
  });
  return JSON.stringify({ predictions });
}

async function runModel(
  model: RosterModel,
  stage: StageId,
  fixtures: Fixture[],
  prompt: string,
  mock: boolean,
): Promise<{ slug: string; ok: boolean; attempts: number; error?: string; costUsd?: number }> {
  const slug = modelSlug(model.id);
  let params: Record<string, unknown> = { temperature: 0 };
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const attemptPrompt =
      attempt === 1
        ? prompt
        : `${prompt}\n\nYOUR PREVIOUS ATTEMPT WAS INVALID. Errors:\n${lastErrors
            .slice(0, 20)
            .map((e) => `- ${e}`)
            .join("\n")}\nRespond again with ONLY the corrected, complete JSON object.`;
    const requestedAt = new Date().toISOString();

    let raw = "";
    let usage: Record<string, unknown> | undefined;
    let latency: number | undefined;
    let status: number | undefined;
    try {
      if (mock) {
        raw = mockRaw(slug, fixtures);
        status = 200;
        latency = 0;
      } else {
        const r = await callOpenRouter(model.id, attemptPrompt, params);
        raw = r.raw;
        usage = r.usage;
        latency = r.latency;
        status = r.status;
      }
    } catch (err) {
      const e = err as Error & { status?: number; body?: string; latency?: number };
      // Temperature unsupported (some reasoning models) -> drop it once and retry same attempt.
      if (e.status === 400 && /temperature/i.test(e.body ?? "") && "temperature" in params) {
        params = {};
        appendRaw(stage, slug, {
          ts: requestedAt, model: model.id, stage, attempt, prompt_version: PROMPT_VERSION,
          params: { temperature: 0 }, request_chars: attemptPrompt.length,
          http_status: e.status, error: "temperature rejected; retrying without it", ok: false,
        });
        attempt--;
        continue;
      }
      appendRaw(stage, slug, {
        ts: requestedAt, model: model.id, stage, attempt, prompt_version: PROMPT_VERSION,
        params, request_chars: attemptPrompt.length, http_status: e.status,
        latency_ms: e.latency, error: e.message, ok: false,
        ...(attempt === 1 ? { prompt } : {}),
      });
      lastErrors = [`API error: ${e.message.slice(0, 300)}`];
      continue;
    }

    const completedAt = new Date().toISOString();
    const validation = validatePredictions(raw, fixtures);
    appendRaw(stage, slug, {
      ts: requestedAt, model: model.id, stage, attempt, prompt_version: PROMPT_VERSION,
      params, request_chars: attemptPrompt.length, response_raw: raw, usage,
      latency_ms: latency, http_status: status,
      validation_errors: validation.ok ? undefined : validation.errors.slice(0, 50),
      validation_warnings: validation.warnings.length > 0 ? validation.warnings.slice(0, 20) : undefined,
      ok: validation.ok,
      ...(attempt === 1 ? { prompt } : {}),
    });

    if (validation.ok) {
      const costUsd = typeof usage?.cost === "number" ? (usage.cost as number) : undefined;
      const file: PredictionFile = {
        model: model.id, slug, stage, prompt_version: PROMPT_VERSION, params,
        requested_at: requestedAt, completed_at: completedAt, attempts: attempt,
        usage: {
          prompt_tokens: usage?.prompt_tokens as number | undefined,
          completion_tokens: usage?.completion_tokens as number | undefined,
          total_tokens: usage?.total_tokens as number | undefined,
          cost_usd: costUsd,
        },
        predictions: validation.predictions,
      };
      const dir = path.join(process.cwd(), "data", "predictions", stage);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(file, null, 2) + "\n", "utf-8");
      return { slug, ok: true, attempts: attempt, costUsd };
    }
    lastErrors = validation.errors;
  }
  return { slug, ok: false, attempts: MAX_ATTEMPTS, error: lastErrors.slice(0, 3).join(" | ") };
}

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs();
  const fixtures = loadStageFixtures(args.stage);
  const prompt = buildStagePrompt(args.stage, fixtures);

  if (args.dryRun) {
    console.log(prompt);
    console.log(`\n--- dry run: ${fixtures.length} fixtures, prompt ${prompt.length} chars ---`);
    return;
  }
  if (!args.mock && !process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY missing. Copy .env.example to .env and set it (see BACKLOG §0).");
    process.exit(1);
  }

  let roster = loadRoster();
  if (args.models !== "all") {
    const wanted = new Set(args.models.split(",").map((s) => s.trim()));
    roster = roster.filter((m) => wanted.has(m.id) || wanted.has(modelSlug(m.id)));
  }
  if (args.onlyMissing) {
    roster = roster.filter(
      (m) => !fs.existsSync(path.join("data", "predictions", args.stage, `${modelSlug(m.id)}.json`)),
    );
  }
  if (roster.length === 0) {
    console.log("Nothing to do (roster empty after filters).");
    return;
  }

  console.log(
    `PunditBench runner — stage=${args.stage}, fixtures=${fixtures.length}, models=${roster.length}, mock=${args.mock}, prompt=${PROMPT_VERSION} (${prompt.length} chars)`,
  );

  const queue = [...roster];
  const outcomes: Awaited<ReturnType<typeof runModel>>[] = [];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let m = queue.shift(); m; m = queue.shift()) {
        const started = Date.now();
        const o = await runModel(m, args.stage, fixtures, prompt, args.mock);
        outcomes.push(o);
        console.log(
          `${o.ok ? "OK  " : "FAIL"} ${o.slug} (attempts=${o.attempts}, ${Math.round((Date.now() - started) / 1000)}s${o.costUsd !== undefined ? `, $${o.costUsd.toFixed(4)}` : ""}${o.error ? `, ${o.error.slice(0, 160)}` : ""})`,
        );
      }
    }),
  );

  const failed = outcomes.filter((o) => !o.ok);
  const cost = outcomes.reduce((s, o) => s + (o.costUsd ?? 0), 0);
  console.log(`\nDone: ${outcomes.length - failed.length}/${outcomes.length} models OK. Total cost: $${cost.toFixed(2)}`);
  if (failed.length > 0) {
    console.log(`Failed (per D5 these score 0 unless rerun before kickoff): ${failed.map((f) => f.slug).join(", ")}`);
    process.exitCode = 2;
  }
  console.log(`Next: npm run hash -- --stage ${args.stage}   (then commit + push)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
