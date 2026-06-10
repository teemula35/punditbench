/**
 * B4/B5 manual results entry (git is the admin UI).
 *
 *   npm run result -- <match> <home>-<away> [--advances "Team Name"] [--note "2-1 a.e.t."]
 *   npm run result -- <match> --voided
 *
 * The score is the 90-minute result. For knockout matches that go further, pass
 * the 90' draw as the score, the progressing team via --advances and the ET/pens
 * detail via --note. Prints every model's points for the match as a sanity check.
 */
import { fixturesByMatch, loadAllPredictions, loadResults, writeResults } from "../lib/data";
import { isKnockout, scoreMatch } from "../lib/scoring";
import type { MatchResult } from "../lib/types";

const argv = process.argv.slice(2);
const matchNo = Number(argv[0]);
const fixture = fixturesByMatch().get(matchNo);
if (!fixture) {
  console.error(`Unknown match number "${argv[0]}". Usage: npm run result -- 1 2-1`);
  process.exit(1);
}

let result: MatchResult;
if (argv.includes("--voided")) {
  result = { match: matchNo, status: "voided" };
} else {
  const score = (argv[1] ?? "").match(/^(\d{1,2})-(\d{1,2})$/);
  if (!score) {
    console.error(`Score must look like 2-1 (got "${argv[1]}").`);
    process.exit(1);
  }
  const home_goals = Number(score[1]);
  const away_goals = Number(score[2]);
  const advIdx = argv.indexOf("--advances");
  const noteIdx = argv.indexOf("--note");
  const advances = advIdx !== -1 ? argv[advIdx + 1] : undefined;
  const note = noteIdx !== -1 ? argv[noteIdx + 1] : undefined;

  if (isKnockout(fixture.stage)) {
    const adv = advances ?? (home_goals > away_goals ? fixture.home : away_goals > home_goals ? fixture.away : undefined);
    if (!adv) {
      console.error(`Knockout draw after 90' — pass --advances "${fixture.home}" or "${fixture.away}".`);
      process.exit(1);
    }
    if (adv !== fixture.home && adv !== fixture.away) {
      console.error(`--advances must be exactly "${fixture.home}" or "${fixture.away}".`);
      process.exit(1);
    }
    result = { match: matchNo, status: "final", home_goals, away_goals, advances: adv, ...(note ? { note } : {}) };
  } else {
    result = { match: matchNo, status: "final", home_goals, away_goals, ...(note ? { note } : {}) };
  }
}

const results = loadResults().filter((r) => r.match !== matchNo);
results.push(result);
writeResults(results);

const desc =
  result.status === "voided"
    ? "VOIDED"
    : `${result.home_goals}-${result.away_goals}${result.advances ? ` (${result.advances} advances)` : ""}${result.note ? ` [${result.note}]` : ""}`;
console.log(`Match ${matchNo}: ${fixture.home} vs ${fixture.away} -> ${desc}\n`);

if (result.status === "final") {
  const rows: { slug: string; pts: number; how: string }[] = [];
  for (const [slug, files] of loadAllPredictions()) {
    const file = files.find((f) => f.stage === fixture.stage);
    const prediction = file?.predictions.find((p) => p.match === matchNo);
    const s = scoreMatch(prediction, result, fixture);
    if (s) {
      rows.push({
        slug,
        pts: s.points,
        how: prediction
          ? `${prediction.home_goals}-${prediction.away_goals}${prediction.advances ? `/${prediction.advances}` : ""} (${s.breakdown}${s.advance_bonus ? "+adv" : ""})`
          : "no prediction",
      });
    }
  }
  rows.sort((a, b) => b.pts - a.pts || a.slug.localeCompare(b.slug));
  for (const r of rows) console.log(`  ${String(r.pts).padStart(2)} pts  ${r.slug.padEnd(40)} ${r.how}`);
  console.log(`\nNow: git add data/results.json; git commit -m "Result: match ${matchNo} ${desc}"; git push`);
}
