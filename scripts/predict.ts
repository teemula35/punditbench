/**
 * PunditBench prediction runner for REAL fixtures (A1/A3/A4/A5).
 *
 *   npm run predict -- --stage group [--models all|id1,id2] [--mock] [--dry-run] [--only-missing]
 *   npm run predict -- --stage r32 --live [--exclude 73,74] [--reason "..."]   # round-by-round track
 *
 * One identical prompt per stage for every roster model (D4); shared run
 * machinery (adapter, retries, audit logging) lives in lib/runner.ts.
 *
 * Knockout stages have two uses:
 *  - Locked self-consistent bracket simulation is the primary design
 *    (scripts/simulate.ts), written to data/predictions/.
 *  - `--live` is the ROUND-BY-ROUND track: every model predicts the REAL
 *    knockout pairings of one round, written to data/predictions-live/ +
 *    data/raw-live/ (a separate tree, scored directly). Pass `--exclude` for
 *    matches that already kicked off so they aren't falsely "pre-registered";
 *    those are recorded with a reason in the live manifest.
 */
import fs from "node:fs";
import path from "node:path";
import { buildPrompt, modelSlug, PROMPT_VERSION } from "../lib/prompt";
import { isKnockout } from "../lib/scoring";
import { loadEnv, runModelOnFixtures } from "../lib/runner";
import {
  fixturesByMatch,
  loadGroupOrderOverride,
  loadLiveManifest,
  loadResults,
  loadRoster,
  loadStageFixtures,
  loadTeams,
} from "../lib/data";
import { groupTable } from "../lib/standings";
import type { Fixture, MatchResult, StageId } from "../lib/types";
import { KNOCKOUT_STAGES } from "../lib/types";

const CONCURRENCY = 4;

interface Args {
  stage: StageId;
  models: string;
  mock: boolean;
  dryRun: boolean;
  onlyMissing: boolean;
  live: boolean;
  exclude: number[];
  reason: string;
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
  const live = argv.includes("--live");
  if (live && !KNOCKOUT_STAGES.includes(stage)) {
    console.error(`--live is for knockout rounds only (got stage "${stage}").`);
    process.exit(1);
  }
  return {
    stage,
    models: get("--models") ?? "all",
    mock: argv.includes("--mock"),
    dryRun: argv.includes("--dry-run"),
    onlyMissing: argv.includes("--only-missing"),
    live,
    exclude: (get("--exclude") ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0),
    reason: get("--reason") ?? "Kicked off before the round-by-round picks were collected.",
  };
}

/** Merge this round into data/predictions-live/manifest.json (excluded + lock metadata). */
function writeLiveManifest(stage: StageId, excluded: number[], reason: string): void {
  const manifest = loadLiveManifest();
  // Count the stored files on disk, not this run's tally — keeps the total
  // correct across --only-missing reruns.
  const stageDir = path.join("data", "predictions-live", stage);
  const models = fs.existsSync(stageDir)
    ? fs.readdirSync(stageDir).filter((f) => f.endsWith(".json")).length
    : 0;
  manifest.rounds[stage] = { locked_at: new Date().toISOString(), models, excluded };
  for (const m of excluded) manifest.excluded[String(m)] = reason;
  const dir = path.join("data", "predictions-live");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`Updated data/predictions-live/manifest.json (round ${stage}, excluded [${excluded.join(", ")}]).`);
}

/** Real-fixture knockout prompts include actual results so far (D4). */
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
  const knockoutResults = allFixtures
    .filter((f) => isKnockout(f.stage) && results.get(f.match)?.status === "final")
    .map((f) => ({ fixture: f, result: results.get(f.match)! }));
  return buildPrompt(stage, fixtures, { groupTables, knockoutResults, mode: "real" });
}

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs();
  let fixtures = loadStageFixtures(args.stage);
  if (args.live && args.exclude.length > 0) {
    const ex = new Set(args.exclude);
    const before = fixtures.length;
    fixtures = fixtures.filter((f) => !ex.has(f.match));
    console.log(
      `Live: excluding ${before - fixtures.length} already-kicked-off match(es) from pre-registration (${args.exclude.join(", ")}).`,
    );
  }
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
    const base = args.live ? "predictions-live" : "predictions";
    roster = roster.filter(
      (m) => !fs.existsSync(path.join("data", base, args.stage, `${modelSlug(m.id)}.json`)),
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
  const outcomes: { slug: string; ok: boolean; attempts: number; error?: string; costUsd?: number }[] = [];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let m = queue.shift(); m; m = queue.shift()) {
        const started = Date.now();
        const o = await runModelOnFixtures(m, modelSlug(m.id), args.stage, fixtures, prompt, {
          mock: args.mock,
          promptVersion: PROMPT_VERSION,
          ...(args.live ? { variant: "live" as const } : {}),
        });
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
  if (args.live) {
    writeLiveManifest(args.stage, args.exclude, args.reason);
  }
  console.log(`Next: npm run hash -- --stage ${args.stage}${args.live ? " --live" : ""}   (then commit + push)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
