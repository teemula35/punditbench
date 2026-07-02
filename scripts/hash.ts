/**
 * A6 pre-registration: canonical SHA-256 over stored predictions.
 *
 *   npm run hash -- --stage <group|r32|r16|qf|sf|third|final|all> [--live]   WC trees
 *   npm run hash -- --comp <id> --round <mdNN>                               league round (live track)
 *
 * Writes data/hashes/<stage>[-live].txt or data/competitions/<id>/hashes/
 * <round>-live.txt and prints the hash + the publication commands.
 * Canonical form v2 lives in lib/hashing.ts (shared with league-predict).
 */
import fs from "node:fs";
import path from "node:path";
import {
  getCompetition,
  loadAllLivePredictions,
  loadAllPredictions,
  loadCompetitionLivePredictions,
} from "../lib/data";
import { canonicalPayload, sha256 } from "../lib/hashing";
import { isMatchdayKey } from "../lib/types";
import type { PredictionFile, StageId } from "../lib/types";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const compId = arg("--comp");
const live = process.argv.includes("--live");

let files: PredictionFile[];
let outFile: string;
let trackLine: string;
let scopeLines: string[];
let recompute: string;
let tagName: string;
let commitScope: string;

if (compId) {
  const round = arg("--round");
  if (!round || !isMatchdayKey(round)) {
    console.error("Usage: npm run hash -- --comp <id> --round <mdNN>");
    process.exit(1);
  }
  const comp = getCompetition(compId);
  files = [...loadCompetitionLivePredictions(comp.id).values()].flat().filter((f) => f.stage === round);
  outFile = path.join(process.cwd(), "data", "competitions", comp.id, "hashes", `${round}-live.txt`);
  trackLine = "round-by-round (live, real fixtures)";
  scopeLines = [`competition: ${comp.id}`, `round: ${round}`];
  recompute = `npm run hash -- --comp ${comp.id} --round ${round}`;
  tagName = `predictions-${comp.id}-${round}-live`;
  commitScope = `${comp.short_name} ${round}`;
} else {
  const stageArg = arg("--stage") as StageId | "all" | undefined;
  if (!stageArg) {
    console.error(
      "Usage: npm run hash -- --stage <group|r32|r16|qf|sf|third|final|all> [--live] | --comp <id> --round <mdNN>",
    );
    process.exit(1);
  }
  const all = live ? loadAllLivePredictions() : loadAllPredictions();
  files = [...all.values()].flat().filter((f) => stageArg === "all" || f.stage === stageArg);
  outFile = path.join(process.cwd(), "data", "hashes", `${stageArg}${live ? "-live" : ""}.txt`);
  trackLine = live ? "round-by-round (live, real fixtures)" : "locked (pre-kickoff)";
  scopeLines = [`stage: ${stageArg}`];
  recompute = `npm run hash -- --stage ${stageArg}${live ? " --live" : ""}`;
  tagName = `predictions-${stageArg}${live ? "-live" : ""}`;
  commitScope = `${live ? "round-by-round " : ""}${stageArg}`;
}

if (files.length === 0) {
  console.error("No stored predictions for the requested scope.");
  process.exit(1);
}

const payload = canonicalPayload(files);
const hash = sha256(payload);

fs.mkdirSync(path.dirname(outFile), { recursive: true });
const record = [
  `track: ${trackLine}`,
  ...scopeLines,
  `models: ${files.length}`,
  `generated_at: ${new Date().toISOString()}`,
  `sha256: ${hash}`,
  "",
  "Canonical form v2: JSON array of {slug, model, stage, completed_at, simulated_fixtures?",
  "(sorted by match), predictions (sorted by match)}, sorted by (slug, stage), no whitespace.",
  "(Tags predictions-group / predictions-group-v2 used form v1: {slug, model, completed_at,",
  "predictions} — their recorded hashes remain valid against that form.)",
  `Recompute with: ${recompute}`,
].join("\n");
fs.writeFileSync(outFile, record + "\n", "utf-8");

console.log(record);
console.log(`\nPublish (pre-registration):`);
console.log(
  `  git add -A; git commit -m "Lock ${commitScope} predictions (${files.length} models) sha256=${hash.slice(0, 16)}..."`,
);
console.log(`  git tag ${tagName}; git push --follow-tags`);
