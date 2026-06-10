/**
 * Self-consistent bracket simulation: every roster model predicts its OWN
 * knockout tournament, derived from its OWN group-stage predictions —
 * R32 → R16 → QF → SF → third place + final. No real-world results involved,
 * so the entire run can happen (and be hashed) before the opening kickoff.
 *
 *   npm run simulate [-- --models all|id,id] [--mock] [--resume]
 *
 * --resume skips (model, stage) pairs whose prediction file already exists and
 * re-derives later rounds from the stored files, so an interrupted run picks
 * up exactly where it stopped.
 */
import fs from "node:fs";
import path from "node:path";
import {
  advancesByMatch,
  buildNextSimulatedRound,
  buildSimulatedR32,
  simulateGroups,
} from "../lib/bracket";
import {
  loadKnockoutTemplate,
  loadRoster,
  loadStageFixtures,
  loadTeams,
  loadThirdAllocationTable,
} from "../lib/data";
import { buildPrompt, modelSlug } from "../lib/prompt";
import { loadEnv, runModelOnFixtures } from "../lib/runner";
import type { Fixture, MatchResult, PredictionFile, RosterModel, StageId } from "../lib/types";

const SIM_PROMPT_VERSION = "sim-v1";
const CONCURRENCY = 4;
const ROUNDS: StageId[] = ["r32", "r16", "qf", "sf", "third", "final"];

const argv = process.argv.slice(2);
const mock = argv.includes("--mock");
const resume = argv.includes("--resume");
const modelsArg = (() => {
  const i = argv.indexOf("--models");
  return i !== -1 ? argv[i + 1] : "all";
})();

function predictionPath(stage: StageId, slug: string): string {
  return path.join("data", "predictions", stage, `${slug}.json`);
}

function loadStored(stage: StageId, slug: string): PredictionFile | undefined {
  const p = predictionPath(stage, slug);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf-8")) as PredictionFile) : undefined;
}

async function simulateModel(
  model: RosterModel,
  teams: ReturnType<typeof loadTeams>,
  groupFixtures: Fixture[],
  template: ReturnType<typeof loadKnockoutTemplate>,
  allocation: Record<string, Record<string, string>>,
): Promise<{ slug: string; ok: boolean; failedStage?: StageId; error?: string; costUsd: number }> {
  const slug = modelSlug(model.id);
  const groupFile = loadStored("group", slug);
  if (!groupFile) {
    return { slug, ok: false, failedStage: "group", error: "no group predictions stored", costUsd: 0 };
  }

  const sim = simulateGroups(groupFile, teams, groupFixtures);
  let cost = 0;

  // The model's predicted knockout story so far, accumulated round by round
  // (feeds the prompt context exactly like a real tournament would).
  const knockoutSoFar: { fixture: Fixture; result: MatchResult }[] = [];
  const decided = new Map<number, { home: string; away: string; advances: string }>();

  for (const stage of ROUNDS) {
    let fixtures: Fixture[];
    try {
      fixtures =
        stage === "r32"
          ? buildSimulatedR32(sim, template, allocation)
          : buildNextSimulatedRound(template, stage, decided);
    } catch (e) {
      return { slug, ok: false, failedStage: stage, error: (e as Error).message, costUsd: cost };
    }

    let file = resume ? loadStored(stage, slug) : undefined;
    const storedMatchesBracket =
      file &&
      JSON.stringify(file.simulated_fixtures?.map((f) => [f.match, f.home, f.away])) ===
        JSON.stringify(fixtures.map((f) => [f.match, f.home, f.away]));

    if (!storedMatchesBracket) {
      const prompt = buildPrompt(stage, fixtures, {
        groupTables: sim.tables,
        knockoutResults: knockoutSoFar,
        mode: "simulated",
      });
      const outcome = await runModelOnFixtures(model, slug, stage, fixtures, prompt, {
        mock,
        promptVersion: SIM_PROMPT_VERSION,
        storeSimulatedFixtures: true,
      });
      cost += outcome.costUsd ?? 0;
      if (!outcome.ok || !outcome.file) {
        return { slug, ok: false, failedStage: stage, error: outcome.error, costUsd: cost };
      }
      file = outcome.file;
    }

    for (const [match, entry] of advancesByMatch(file!)) {
      decided.set(match, entry);
      const p = file!.predictions.find((x) => x.match === match)!;
      knockoutSoFar.push({
        fixture: fixtures.find((f) => f.match === match)!,
        result: {
          match,
          status: "final",
          home_goals: p.home_goals,
          away_goals: p.away_goals,
          advances: entry.advances,
        },
      });
    }
  }
  return { slug, ok: true, costUsd: cost };
}

async function main(): Promise<void> {
  loadEnv();
  if (!mock && !process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY missing (.env).");
    process.exit(1);
  }
  const teams = loadTeams();
  const groupFixtures = loadStageFixtures("group");
  const template = loadKnockoutTemplate();
  const allocation = loadThirdAllocationTable();

  let roster = loadRoster();
  if (modelsArg !== "all") {
    const wanted = new Set(modelsArg.split(",").map((s) => s.trim()));
    roster = roster.filter((m) => wanted.has(m.id) || wanted.has(modelSlug(m.id)));
  }

  console.log(
    `PunditBench bracket simulation — ${roster.length} models × ${ROUNDS.length} rounds, prompt=${SIM_PROMPT_VERSION}, mock=${mock}, resume=${resume}`,
  );

  const queue = [...roster];
  const outcomes: Awaited<ReturnType<typeof simulateModel>>[] = [];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let m = queue.shift(); m; m = queue.shift()) {
        const started = Date.now();
        const o = await simulateModel(m, teams, groupFixtures, template, allocation);
        outcomes.push(o);
        console.log(
          `${o.ok ? "OK  " : "FAIL"} ${o.slug} (${Math.round((Date.now() - started) / 1000)}s, $${o.costUsd.toFixed(4)}${o.ok ? "" : `, failed at ${o.failedStage}: ${o.error?.slice(0, 160)}`})`,
        );
      }
    }),
  );

  const failed = outcomes.filter((o) => !o.ok);
  const cost = outcomes.reduce((s, o) => s + o.costUsd, 0);
  console.log(`\nDone: ${outcomes.length - failed.length}/${outcomes.length} full brackets. Total cost: $${cost.toFixed(2)}`);
  if (failed.length > 0) {
    console.log(`Failed: ${failed.map((f) => `${f.slug}@${f.failedStage}`).join(", ")}`);
    console.log(`Retry just these with: npm run simulate -- --resume --models ${failed.map((f) => f.slug).join(",")}`);
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
