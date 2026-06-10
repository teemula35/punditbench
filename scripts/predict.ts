/**
 * PunditBench prediction runner for REAL fixtures (A1/A3/A4/A5).
 *
 *   npm run predict -- --stage group [--models all|id1,id2] [--mock] [--dry-run] [--only-missing]
 *
 * One identical prompt per stage for every roster model (D4); shared run
 * machinery (adapter, retries, audit logging) lives in lib/runner.ts.
 * Knockout stages here would use REAL pairings — the primary design since
 * 2026-06-11 is self-consistent bracket simulation (scripts/simulate.ts);
 * this runner remains for the group stage and as a fallback.
 */
import fs from "node:fs";
import path from "node:path";
import { buildPrompt, modelSlug, PROMPT_VERSION } from "../lib/prompt";
import { isKnockout } from "../lib/scoring";
import { loadEnv, runModelOnFixtures } from "../lib/runner";
import {
  fixturesByMatch,
  loadGroupOrderOverride,
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
  const outcomes: { slug: string; ok: boolean; attempts: number; error?: string; costUsd?: number }[] = [];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let m = queue.shift(); m; m = queue.shift()) {
        const started = Date.now();
        const o = await runModelOnFixtures(m, modelSlug(m.id), args.stage, fixtures, prompt, {
          mock: args.mock,
          promptVersion: PROMPT_VERSION,
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
  console.log(`Next: npm run hash -- --stage ${args.stage}   (then commit + push)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
