/**
 * Roster availability checker — is every model in data/roster.json still callable?
 *
 *   npm exec tsx scripts/roster-availability.ts            # ping every roster id (needs OPENROUTER_API_KEY)
 *   node --import tsx scripts/roster-availability.ts --catalog   # auth-free: diff roster vs live /models catalog
 *   node --import tsx scripts/roster-availability.ts --models openai/gpt-5.5,meta-llama/llama-3-70b-instruct
 *   node --import tsx scripts/roster-availability.ts --json report.json
 *
 * Two independent checks, either or both:
 *   (1) PING  (default): sends a minimal max_tokens request to each roster id through
 *       the SAME OpenRouter adapter the benchmark uses (lib/runner.callOpenRouter), so a
 *       pass means "this key can actually call this id right now". Classifies each as
 *       OK (2xx) / DEAD (HTTP 404 "No endpoints found") / ERROR (any other non-2xx).
 *       This is the authoritative check — it exercises the real credential + routing.
 *       Requires OPENROUTER_API_KEY (copy .env.example to .env). Costs a few tokens/model.
 *   (2) CATALOG (--catalog): fetches the public https://openrouter.ai/api/v1/models list
 *       (no auth) and diffs roster ids against it. Cheaper and key-free, but only tells you
 *       whether the id is LISTED, not whether your account/credits can invoke it. Mirrors the
 *       curl+jq one-liner documented in scratchpad/model-pool-research.md.
 *
 * Exit code is non-zero if any model is DEAD (or, in --catalog mode, missing from the
 * catalog) so this can gate a pre-round lock in CI. Deaths are the llama-3-70b scenario:
 * a roster id that returns 404 "No endpoints found" mid-season (see data/raw-live/**).
 *
 * NOTE (reasoning models): the ping sends only { max_tokens: PROBE_TOKENS } and never a
 * temperature, so reasoning-only ids (gpt-5.5, claude-fable-5, …) do not 400 on sampling
 * params. A model that rejects a tiny max_tokens is reported ERROR (not DEAD) — that is the
 * honest signal ("endpoint answered, but investigate"), never a false death.
 */
import fs from "node:fs";
import { loadRoster } from "../lib/data";
import { modelSlug } from "../lib/prompt";
import { callOpenRouter, loadEnv } from "../lib/runner";
import type { RosterModel } from "../lib/types";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CONCURRENCY = 4;
const PROBE_TOKENS = 1; // minimal-cost liveness probe
const PROBE_PROMPT = "ping";

type Status = "OK" | "DEAD" | "ERROR";

interface Result {
  id: string;
  label: string;
  tier: RosterModel["tier"];
  status: Status;
  httpStatus?: number;
  detail?: string;
  latencyMs?: number;
}

interface Args {
  catalog: boolean;
  models?: Set<string>;
  json?: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const models = get("--models");
  return {
    catalog: argv.includes("--catalog"),
    models: models ? new Set(models.split(",").map((s) => s.trim())) : undefined,
    json: get("--json"),
  };
}

/** True 404 "No endpoints found" is the confirmed-dead signature (see llama-3-70b logs). */
function isDead(httpStatus: number | undefined, body: string): boolean {
  return httpStatus === 404 || /no endpoints found/i.test(body);
}

/** PING one id: a real minimal call through the benchmark's OpenRouter adapter. */
async function pingModel(m: RosterModel): Promise<Result> {
  const started = Date.now();
  try {
    const r = await callOpenRouter(m.id, PROBE_PROMPT, { max_tokens: PROBE_TOKENS });
    return {
      id: m.id, label: m.label, tier: m.tier, status: "OK",
      httpStatus: r.status, latencyMs: Date.now() - started,
    };
  } catch (err) {
    const e = err as Error & { status?: number; body?: string };
    const body = e.body ?? e.message ?? "";
    const status: Status = isDead(e.status, body) ? "DEAD" : "ERROR";
    return {
      id: m.id, label: m.label, tier: m.tier, status,
      httpStatus: e.status, detail: body.slice(0, 200), latencyMs: Date.now() - started,
    };
  }
}

/** PING mode: fan out over the roster with bounded concurrency (season-predict pattern). */
async function runPing(roster: RosterModel[]): Promise<Result[]> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error(
      "OPENROUTER_API_KEY missing. Copy .env.example to .env and set it, or use --catalog for the key-free catalog diff.",
    );
    process.exit(1);
  }
  const queue = [...roster];
  const results: Result[] = [];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let m = queue.shift(); m; m = queue.shift()) {
        const r = await pingModel(m);
        results.push(r);
        console.log(
          `${r.status.padEnd(5)} ${r.id}${r.httpStatus ? ` [${r.httpStatus}]` : ""}${
            r.latencyMs !== undefined ? ` ${r.latencyMs}ms` : ""
          }${r.detail ? ` — ${r.detail.replace(/\s+/g, " ")}` : ""}`,
        );
      }
    }),
  );
  return results;
}

/** CATALOG mode: auth-free diff of roster ids against the live /models list. */
async function runCatalog(roster: RosterModel[]): Promise<Result[]> {
  const res = await fetch(OPENROUTER_MODELS_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    console.error(`Could not fetch ${OPENROUTER_MODELS_URL}: HTTP ${res.status}`);
    process.exit(1);
  }
  const json = (await res.json()) as { data: { id: string }[] };
  const live = new Set(json.data.map((d) => d.id));
  console.log(`Live catalog: ${live.size} models listed at ${OPENROUTER_MODELS_URL}\n`);
  const results = roster.map<Result>((m) => {
    const present = live.has(m.id);
    const r: Result = {
      id: m.id, label: m.label, tier: m.tier,
      status: present ? "OK" : "DEAD",
      detail: present ? undefined : "not listed in live catalog",
    };
    console.log(`${r.status.padEnd(5)} ${r.id}${present ? "" : " — not in catalog"}`);
    return r;
  });
  return results;
}

function summarise(results: Result[]): { dead: Result[]; error: Result[] } {
  const by = (s: Status) => results.filter((r) => r.status === s);
  const dead = by("DEAD");
  const error = by("ERROR");
  console.log(
    `\n${results.length} models: ${by("OK").length} OK, ${dead.length} DEAD, ${error.length} ERROR`,
  );
  if (dead.length > 0) {
    console.log("\nDEAD (drop, or replace at the next checkpoint):");
    for (const r of dead) console.log(`  - ${r.id} (${r.tier})${r.detail ? ` — ${r.detail}` : ""}`);
  }
  if (error.length > 0) {
    console.log("\nERROR (investigate — not necessarily dead):");
    for (const r of error) console.log(`  - ${r.id} [${r.httpStatus ?? "?"}]${r.detail ? ` — ${r.detail}` : ""}`);
  }
  return { dead, error };
}

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs();

  let roster = loadRoster();
  if (args.models) {
    roster = roster.filter((m) => args.models!.has(m.id) || args.models!.has(modelSlug(m.id)));
  }
  if (roster.length === 0) {
    console.log("Nothing to check (roster empty after --models filter).");
    return;
  }

  console.log(
    `roster-availability — ${roster.length} models, mode=${args.catalog ? "catalog (auth-free)" : "ping (live call)"}\n`,
  );
  const results = args.catalog ? await runCatalog(roster) : await runPing(roster);
  const { dead } = summarise(results);

  if (args.json) {
    fs.writeFileSync(args.json, JSON.stringify({ checked_at: new Date().toISOString(), results }, null, 2) + "\n", "utf-8");
    console.log(`\nWrote ${args.json}`);
  }

  process.exit(dead.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
