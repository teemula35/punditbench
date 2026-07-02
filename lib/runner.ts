/**
 * Shared prediction-run machinery used by scripts/predict.ts (real fixtures)
 * and scripts/simulate.ts (per-model simulated brackets): OpenRouter adapter,
 * bounded retry loop with validator feedback (D5), raw JSONL audit logging,
 * prediction-file persistence.
 */
import fs from "node:fs";
import path from "node:path";
import { validatePredictions } from "./validate";
import { isKnockout } from "./scoring";
import type { Fixture, PredictionFile, RosterModel, RoundKey } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const MAX_ATTEMPTS = 3;

export function loadEnv(): void {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

export interface AttemptLog {
  ts: string;
  model: string;
  stage: RoundKey;
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
  prompt?: string;
}

export function appendRaw(
  stage: RoundKey,
  slug: string,
  entry: AttemptLog,
  base = "raw",
  dataRoot = "data",
): void {
  const dir = path.join(process.cwd(), dataRoot, base, stage);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, `${slug}.jsonl`), JSON.stringify(entry) + "\n", "utf-8");
}

export async function callOpenRouter(
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
export function mockRaw(slug: string, fixtures: Fixture[]): string {
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

export interface RunOutcome {
  slug: string;
  ok: boolean;
  attempts: number;
  error?: string;
  costUsd?: number;
  file?: PredictionFile;
}

export interface RunOptions {
  mock?: boolean;
  promptVersion: string;
  /** Embed the model's own (simulated) fixtures in the stored prediction file. */
  storeSimulatedFixtures?: boolean;
  /**
   * "live" routes storage to data/predictions-live/ + data/raw-live/ (the
   * round-by-round real-fixture track), keeping the locked simulated tree intact.
   */
  variant?: "live";
  /**
   * Base data directory relative to cwd (default "data"). League competitions
   * pass "data/competitions/<id>" so predictions/raw land in their own tree.
   */
  dataRoot?: string;
}

/** One model × one fixture set: attempts → validation → persistence. */
export async function runModelOnFixtures(
  model: RosterModel,
  slug: string,
  stage: RoundKey,
  fixtures: Fixture[],
  prompt: string,
  opts: RunOptions,
): Promise<RunOutcome> {
  let params: Record<string, unknown> = { temperature: 0 };
  let lastErrors: string[] = [];
  const predBase = opts.variant === "live" ? "predictions-live" : "predictions";
  const rawBase = opts.variant === "live" ? "raw-live" : "raw";

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
      if (opts.mock) {
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
      if (e.status === 400 && /temperature/i.test(e.body ?? "") && "temperature" in params) {
        params = {};
        appendRaw(stage, slug, {
          ts: requestedAt, model: model.id, stage, attempt, prompt_version: opts.promptVersion,
          params: { temperature: 0 }, request_chars: attemptPrompt.length,
          http_status: e.status, error: "temperature rejected; retrying without it", ok: false,
        }, rawBase, opts.dataRoot);
        attempt--;
        continue;
      }
      appendRaw(stage, slug, {
        ts: requestedAt, model: model.id, stage, attempt, prompt_version: opts.promptVersion,
        params, request_chars: attemptPrompt.length, http_status: e.status,
        latency_ms: e.latency, error: e.message, ok: false,
        ...(attempt === 1 ? { prompt } : {}),
      }, rawBase, opts.dataRoot);
      lastErrors = [`API error: ${e.message.slice(0, 300)}`];
      continue;
    }

    const completedAt = new Date().toISOString();
    const validation = validatePredictions(raw, fixtures);
    appendRaw(stage, slug, {
      ts: requestedAt, model: model.id, stage, attempt, prompt_version: opts.promptVersion,
      params, request_chars: attemptPrompt.length, response_raw: raw, usage,
      latency_ms: latency, http_status: status,
      validation_errors: validation.ok ? undefined : validation.errors.slice(0, 50),
      validation_warnings: validation.warnings.length > 0 ? validation.warnings.slice(0, 20) : undefined,
      ok: validation.ok,
      ...(attempt === 1 ? { prompt } : {}),
    }, rawBase);

    if (validation.ok) {
      const costUsd = typeof usage?.cost === "number" ? (usage.cost as number) : undefined;
      const file: PredictionFile = {
        model: model.id, slug, stage, prompt_version: opts.promptVersion, params,
        requested_at: requestedAt, completed_at: completedAt, attempts: attempt,
        usage: {
          prompt_tokens: usage?.prompt_tokens as number | undefined,
          completion_tokens: usage?.completion_tokens as number | undefined,
          total_tokens: usage?.total_tokens as number | undefined,
          cost_usd: costUsd,
        },
        ...(opts.storeSimulatedFixtures
          ? { simulated_fixtures: fixtures.map((f) => ({ match: f.match, home: f.home, away: f.away })) }
          : {}),
        predictions: validation.predictions,
      };
      const dir = path.join(process.cwd(), opts.dataRoot ?? "data", predBase, stage);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(file, null, 2) + "\n", "utf-8");
      return { slug, ok: true, attempts: attempt, costUsd, file };
    }
    lastErrors = validation.errors;
  }
  return { slug, ok: false, attempts: MAX_ATTEMPTS, error: lastErrors.slice(0, 3).join(" | ") };
}
