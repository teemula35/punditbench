/**
 * A6 pre-registration: canonical SHA-256 over all stored predictions of a stage.
 *
 *   npm run hash -- --stage group
 *
 * Writes data/hashes/<stage>.txt and prints the hash + the publication commands.
 * Canonical form: JSON of [{slug, model, completed_at, predictions(sorted by match)}]
 * sorted by slug — independent of file system ordering or whitespace.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadAllPredictions } from "../lib/data";
import type { StageId } from "../lib/types";

const stageArg = process.argv[process.argv.indexOf("--stage") + 1] as StageId | "all" | undefined;
if (!stageArg) {
  console.error("Usage: npm run hash -- --stage <group|r32|r16|qf|sf|third|final|all>");
  process.exit(1);
}

const all = loadAllPredictions();
const canonical = [...all.entries()]
  .flatMap(([, files]) =>
    stageArg === "all" ? files : files.filter((f) => f.stage === stageArg),
  )
  .sort((a, b) => a.slug.localeCompare(b.slug) || a.stage.localeCompare(b.stage))
  .map((f) => ({
    slug: f.slug,
    model: f.model,
    stage: f.stage,
    completed_at: f.completed_at,
    // Simulated stages: the model's own pairings are part of the claim.
    ...(f.simulated_fixtures
      ? { simulated_fixtures: [...f.simulated_fixtures].sort((a, b) => a.match - b.match) }
      : {}),
    predictions: [...f.predictions].sort((a, b) => a.match - b.match),
  }));

if (canonical.length === 0) {
  console.error(`No stored predictions for stage "${stageArg}".`);
  process.exit(1);
}

const payload = JSON.stringify(canonical);
const hash = crypto.createHash("sha256").update(payload).digest("hex");

const dir = path.join(process.cwd(), "data", "hashes");
fs.mkdirSync(dir, { recursive: true });
const record = [
  `stage: ${stageArg}`,
  `models: ${canonical.length}`,
  `generated_at: ${new Date().toISOString()}`,
  `sha256: ${hash}`,
  "",
  "Canonical form v2: JSON array of {slug, model, stage, completed_at, simulated_fixtures?",
  "(sorted by match), predictions (sorted by match)}, sorted by (slug, stage), no whitespace.",
  "(Tags predictions-group / predictions-group-v2 used form v1: {slug, model, completed_at,",
  "predictions} — their recorded hashes remain valid against that form.)",
  "Recompute with: npm run hash -- --stage " + stageArg,
].join("\n");
fs.writeFileSync(path.join(dir, `${stageArg}.txt`), record + "\n", "utf-8");

console.log(record);
console.log(`\nPublish (pre-registration):`);
console.log(`  git add -A; git commit -m "Lock ${stageArg} predictions (${canonical.length} models) sha256=${hash.slice(0, 16)}..."`);
console.log(`  git tag predictions-${stageArg}; git push --follow-tags`);
