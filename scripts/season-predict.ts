/**
 * Pre-season final-table prediction runner (the locked season track).
 *
 *   npm run season-predict -- --comp epl-2026-27 [--models all|id1,id2] [--mock] [--dry-run] [--only-missing]
 *   npm run season-predict -- --comp epl-2026-27 --hash-only
 *
 * One deterministic prompt per competition (alphabetical team list from the
 * ingested fixtures + previous-season context); every roster model predicts
 * the FINAL league table before the opener. Successes land in
 * data/competitions/<id>/predictions-season/<slug>.json with per-attempt raw
 * audit logs in raw-season/<slug>.jsonl (AttemptLog fields, stage "season").
 * The retry loop replicates lib/runner.ts semantics — validator-feedback
 * reprompt, temperature auto-drop on HTTP 400 without consuming the attempt —
 * for the season-table shape lib/runner.ts cannot express. After the run (or
 * with --hash-only alone) the canonical hash over ALL stored season files is
 * written to hashes/season.txt for the pre-registration tag
 * predictions-<id>-season.
 */
import fs from "node:fs";
import path from "node:path";
import { getCompetition, loadCompetitionFixtures, loadRoster } from "../lib/data";
import { sha256 } from "../lib/hashing";
import { loadPreseasonContext, loadPreviousSeason } from "../lib/league-context";
import { modelSlug } from "../lib/prompt";
import { callOpenRouter, loadEnv, MAX_ATTEMPTS } from "../lib/runner";
import {
  buildSeasonPrompt,
  loadSeasonPredictions,
  SEASON_PROMPT_VERSION,
  seasonCanonicalPayload,
  validateSeasonTable,
} from "../lib/season-prediction";
import type { SeasonPredictionFile } from "../lib/season-prediction";
import type { Competition, RosterModel } from "../lib/types";

const CONCURRENCY = 4;

interface Args {
  comp: string;
  models: string;
  mock: boolean;
  dryRun: boolean;
  onlyMissing: boolean;
  hashOnly: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const comp = get("--comp");
  if (!comp) {
    console.error(
      "Usage: season-predict --comp <id> [--models all|id1,id2] [--mock] [--dry-run] [--only-missing] [--hash-only]",
    );
    process.exit(1);
  }
  return {
    comp,
    models: get("--models") ?? "all",
    mock: argv.includes("--mock"),
    dryRun: argv.includes("--dry-run"),
    onlyMissing: argv.includes("--only-missing"),
    hashOnly: argv.includes("--hash-only"),
  };
}

/** Raw JSONL audit entry — lib/runner.ts AttemptLog fields with stage fixed to "season". */
interface SeasonAttemptLog {
  ts: string;
  model: string;
  stage: "season";
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
  ok: boolean;
  prompt?: string;
}

/** Flat per-model log (no stage subdir): data/competitions/<id>/raw-season/<slug>.jsonl. */
function appendSeasonRaw(compId: string, slug: string, entry: SeasonAttemptLog): void {
  const dir = path.join(process.cwd(), "data", "competitions", compId, "raw-season");
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, `${slug}.jsonl`), JSON.stringify(entry) + "\n", "utf-8");
}

/**
 * Deterministic mock table — slug-seeded Fisher-Yates shuffle of the team
 * list, no randomness (same string hash as lib/runner.ts mockRaw), so mock
 * runs are stable per slug.
 */
function mockSeasonRaw(slug: string, teams: string[]): string {
  const h = (s: string): number => {
    let x = 0;
    for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0;
    return x;
  };
  const table = [...teams];
  for (let i = table.length - 1; i > 0; i--) {
    const j = h(`${slug}:${i}`) % (i + 1);
    [table[i], table[j]] = [table[j], table[i]];
  }
  return JSON.stringify({ table });
}

interface SeasonRunOutcome {
  slug: string;
  ok: boolean;
  attempts: number;
  error?: string;
  costUsd?: number;
}

/** One model × one team list: attempts → validation → persistence (runner.ts semantics). */
async function runModelSeason(
  comp: Competition,
  model: RosterModel,
  slug: string,
  teams: string[],
  prompt: string,
  mock: boolean,
): Promise<SeasonRunOutcome> {
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
        raw = mockSeasonRaw(slug, teams);
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
      if (e.status === 400 && /temperature/i.test(e.body ?? "") && "temperature" in params) {
        params = {};
        appendSeasonRaw(comp.id, slug, {
          ts: requestedAt, model: model.id, stage: "season", attempt,
          prompt_version: SEASON_PROMPT_VERSION, params: { temperature: 0 },
          request_chars: attemptPrompt.length, http_status: e.status,
          error: "temperature rejected; retrying without it", ok: false,
        });
        attempt--; // compatibility fallback — the attempt is not consumed
        continue;
      }
      appendSeasonRaw(comp.id, slug, {
        ts: requestedAt, model: model.id, stage: "season", attempt,
        prompt_version: SEASON_PROMPT_VERSION, params,
        request_chars: attemptPrompt.length, http_status: e.status,
        latency_ms: e.latency, error: e.message, ok: false,
        ...(attempt === 1 ? { prompt } : {}),
      });
      lastErrors = [`API error: ${e.message.slice(0, 300)}`];
      continue;
    }

    const completedAt = new Date().toISOString();
    const validation = validateSeasonTable(raw, teams);
    appendSeasonRaw(comp.id, slug, {
      ts: requestedAt, model: model.id, stage: "season", attempt,
      prompt_version: SEASON_PROMPT_VERSION, params,
      request_chars: attemptPrompt.length, response_raw: raw, usage,
      latency_ms: latency, http_status: status,
      validation_errors: validation.ok ? undefined : validation.errors.slice(0, 50),
      ok: validation.ok,
      ...(attempt === 1 ? { prompt } : {}),
    });

    if (validation.ok) {
      const costUsd = typeof usage?.cost === "number" ? (usage.cost as number) : undefined;
      const file: SeasonPredictionFile = {
        model: model.id,
        slug,
        competition: comp.id,
        kind: "season-table",
        prompt_version: SEASON_PROMPT_VERSION,
        params,
        requested_at: requestedAt,
        completed_at: completedAt,
        attempts: attempt,
        usage: {
          prompt_tokens: usage?.prompt_tokens as number | undefined,
          completion_tokens: usage?.completion_tokens as number | undefined,
          total_tokens: usage?.total_tokens as number | undefined,
          cost_usd: costUsd,
        },
        table: validation.table,
      };
      const dir = path.join(process.cwd(), "data", "competitions", comp.id, "predictions-season");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(file, null, 2) + "\n", "utf-8");
      return { slug, ok: true, attempts: attempt, costUsd };
    }
    lastErrors = validation.errors;
  }
  return { slug, ok: false, attempts: MAX_ATTEMPTS, error: lastErrors.slice(0, 3).join(" | ") };
}

/** Canonical hash over ALL stored season files -> data/competitions/<id>/hashes/season.txt. */
function writeSeasonHash(comp: Competition): { models: number; hash: string } | undefined {
  const files = loadSeasonPredictions(comp.id);
  if (files.length === 0) return undefined;
  const hash = sha256(seasonCanonicalPayload(files));
  const dir = path.join(process.cwd(), "data", "competitions", comp.id, "hashes");
  fs.mkdirSync(dir, { recursive: true });
  const record = [
    "track: locked (pre-season final table)",
    `competition: ${comp.id}`,
    `models: ${files.length}`,
    `generated_at: ${new Date().toISOString()}`,
    `sha256: ${hash}`,
    "",
    "Canonical form: JSON array of {slug, model, competition, completed_at, table},",
    "sorted by slug, no whitespace.",
    `Recompute with: npm run season-predict -- --comp ${comp.id} --hash-only`,
  ].join("\n");
  fs.writeFileSync(path.join(dir, "season.txt"), record + "\n", "utf-8");
  return { models: files.length, hash };
}

function printPublish(comp: Competition): void {
  console.log(
    `\nNext (manual run): git add -A; git commit; git tag -a predictions-${comp.id}-season -m "pre-registration lock"; git push --follow-tags; deploy`,
  );
}

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs();
  const comp = getCompetition(args.comp);

  if (args.hashOnly) {
    const info = writeSeasonHash(comp);
    if (!info) {
      console.error(`${comp.id}: no stored season predictions — nothing to hash.`);
      process.exit(1);
    }
    console.log(
      `sha256 ${info.hash} over ${info.models} model file(s) -> data/competitions/${comp.id}/hashes/season.txt`,
    );
    printPublish(comp);
    return;
  }

  const teams = [...new Set(loadCompetitionFixtures(comp.id).flatMap((f) => [f.home, f.away]))].sort(
    (a, b) => a.localeCompare(b),
  );
  if (teams.length === 0) {
    console.error(
      `${comp.id}: no fixtures ingested yet — cannot derive the team list. Run league-fixtures for this competition first.`,
    );
    process.exit(1);
  }

  const preseason = loadPreseasonContext(comp.id);
  const prompt = buildSeasonPrompt(comp, teams, loadPreviousSeason(comp.id), preseason);

  if (args.dryRun) {
    console.log(prompt);
    console.log(
      `\n--- dry run: ${comp.id} season table, ${teams.length} teams, prompt ${prompt.length} chars ---`,
    );
    return;
  }

  if (!args.mock && !process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY missing. Copy .env.example to .env and set it.");
    process.exit(1);
  }

  let roster = loadRoster();
  if (args.models !== "all") {
    const wanted = new Set(args.models.split(",").map((s) => s.trim()));
    roster = roster.filter((m) => wanted.has(m.id) || wanted.has(modelSlug(m.id)));
  }
  if (args.onlyMissing) {
    roster = roster.filter(
      (m) =>
        !fs.existsSync(
          path.join("data", "competitions", comp.id, "predictions-season", `${modelSlug(m.id)}.json`),
        ),
    );
  }
  if (roster.length === 0) {
    console.log(`${comp.id}: nothing to do (roster empty after filters).`);
    return;
  }

  const ctx = preseason
    ? `transfers=${preseason.transfers.length}, injuries=${preseason.injuries.length} (as of ${preseason.as_of})`
    : "no preseason-context.json";
  console.log(
    `season-predict — ${comp.name}: teams=${teams.length}, models=${roster.length}, mock=${args.mock}, prompt=${SEASON_PROMPT_VERSION} (${prompt.length} chars); ${ctx}`,
  );

  const queue = [...roster];
  const outcomes: SeasonRunOutcome[] = [];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let m = queue.shift(); m; m = queue.shift()) {
        const started = Date.now();
        const o = await runModelSeason(comp, m, modelSlug(m.id), teams, prompt, args.mock);
        outcomes.push(o);
        console.log(
          `${o.ok ? "OK  " : "FAIL"} ${o.slug} (attempts=${o.attempts}, ${Math.round((Date.now() - started) / 1000)}s${o.costUsd !== undefined ? `, $${o.costUsd.toFixed(4)}` : ""}${o.error ? `, ${o.error.slice(0, 160)}` : ""})`,
        );
      }
    }),
  );

  const failed = outcomes.filter((o) => !o.ok);
  const cost = outcomes.reduce((s, o) => s + (o.costUsd ?? 0), 0);
  console.log(
    `\n${comp.id} season: ${outcomes.length - failed.length}/${outcomes.length} models OK. Total cost: $${cost.toFixed(2)}`,
  );

  const info = writeSeasonHash(comp);
  if (info) console.log(`sha256 ${info.hash.slice(0, 16)}… over ${info.models} model file(s)`);
  printPublish(comp);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
