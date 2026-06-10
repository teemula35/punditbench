/**
 * G4 audit: verify stored predictions match the last valid attempt in the raw
 * audit logs, re-derive the leaderboard from primary data, and print it.
 *
 *   npm run audit
 */
import fs from "node:fs";
import path from "node:path";
import { fixturesByMatch, loadAllPredictions, resultsByMatch } from "../lib/data";
import { rank, scoreModel, totalsFor } from "../lib/scoring";
import { validatePredictions } from "../lib/validate";
import type { Fixture, StageId } from "../lib/types";

let problems = 0;
const fixtures = fixturesByMatch();
const all = loadAllPredictions();

// 1) Stored predictions must equal the last ok attempt in the raw log.
for (const [slug, files] of all) {
  for (const file of files) {
    const rawPath = path.join("data", "raw", file.stage, `${slug}.jsonl`);
    if (!fs.existsSync(rawPath)) {
      console.log(`MISSING RAW LOG: ${rawPath}`);
      problems++;
      continue;
    }
    const attempts = fs
      .readFileSync(rawPath, "utf-8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { ok: boolean; response_raw?: string });
    const lastOk = [...attempts].reverse().find((a) => a.ok && a.response_raw);
    if (!lastOk) {
      console.log(`NO VALID ATTEMPT IN RAW LOG but predictions stored: ${slug}/${file.stage}`);
      problems++;
      continue;
    }
    // Simulated knockout files validate against the model's OWN pairings.
    const stageFixtures: Fixture[] = file.simulated_fixtures
      ? file.simulated_fixtures.map((s) => ({
          match: s.match, stage: file.stage, home: s.home, away: s.away,
          kickoff_utc: "", city: "",
        }))
      : [...fixtures.values()].filter((f) => f.stage === file.stage);
    const revalidated = validatePredictions(lastOk.response_raw!, stageFixtures);
    const same = JSON.stringify(revalidated.predictions) === JSON.stringify(file.predictions);
    if (!revalidated.ok || !same) {
      console.log(`MISMATCH stored vs raw-log-derived predictions: ${slug}/${file.stage}`);
      problems++;
    }
  }
}

// 2) Re-derive the leaderboard from primary data.
const results = resultsByMatch();
const totals = [...all.entries()].map(([slug, files]) =>
  totalsFor(slug, scoreModel(files, fixtures, results), fixtures),
);
console.log(`\nDerived leaderboard (${results.size} results in):`);
for (const { rank: r, totals: t } of rank(totals)) {
  console.log(
    `  ${String(r).padStart(2)}. ${t.slug.padEnd(40)} ${String(t.points).padStart(4)} pts  (exact ${t.exact}, gd ${t.gd}, outcome ${t.outcome}, adv ${t.advances}, scored ${t.scoredMatches})`,
  );
}

console.log(problems === 0 ? "\nAUDIT OK — stored predictions consistent with raw logs." : `\nAUDIT FAILED — ${problems} problem(s) above.`);
process.exitCode = problems === 0 ? 0 : 1;
