/**
 * Hourly results auto-sync (runs in CI, see .github/workflows/results-sync.yml;
 * also runnable locally). Polls ESPN's public scoreboard for every date that
 * still has a pending past-kickoff fixture, enters new GROUP results, and
 * reports everything that needs a human: finished knockouts, score conflicts,
 * unmapped events, overdue fixtures.
 *
 *   npm run sync-results            enter new results (writes data/results.json)
 *   npm run sync-results -- --dry   plan only, write nothing
 *
 * Exits 0 with GitHub outputs `changed`, `entered` and `alerts`; the workflow
 * fails the run AFTER committing/deploying when alerts is non-empty. Exits 1
 * only on hard errors (network, malformed payload).
 */
import fs from "node:fs";
import { loadAllPredictions, loadFixtures, loadResults, loadTeams, writeResults } from "../lib/data";
import { scoreMatch } from "../lib/scoring";
import { datesToQuery, parseScoreboard, planSync, type EspnEvent } from "../lib/sync";
import type { Fixture, MatchResult } from "../lib/types";

const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const USER_AGENT = "punditbench-results-sync (https://github.com/teemula35/punditbench)";

const dry = process.argv.includes("--dry");

function setOutput(name: string, value: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  // Single-line values only — alerts are joined with "; ".
  fs.appendFileSync(out, `${name}=${value.replace(/\r?\n/g, " ")}\n`);
}

async function fetchEvents(date: string): Promise<EspnEvent[]> {
  const res = await fetch(`${SCOREBOARD}?dates=${date}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`ESPN scoreboard ${date}: HTTP ${res.status}`);
  return parseScoreboard(await res.json());
}

/** Same sanity printout record-result.ts gives: every model's points for the match. */
function printMatchPoints(fixture: Fixture, result: MatchResult): void {
  const rows: { slug: string; pts: number; how: string }[] = [];
  for (const [slug, files] of loadAllPredictions()) {
    const file = files.find((f) => f.stage === fixture.stage);
    const prediction = file?.predictions.find((p) => p.match === fixture.match);
    const s = scoreMatch(prediction, result, fixture);
    if (s) {
      rows.push({
        slug,
        pts: s.points,
        how: prediction ? `${prediction.home_goals}-${prediction.away_goals} (${s.breakdown})` : "no prediction",
      });
    }
  }
  rows.sort((a, b) => b.pts - a.pts || a.slug.localeCompare(b.slug));
  for (const r of rows) console.log(`  ${String(r.pts).padStart(2)} pts  ${r.slug.padEnd(40)} ${r.how}`);
}

const fixtures = loadFixtures();
const results = loadResults();
const teams = loadTeams();
const now = new Date();

const dates = datesToQuery(fixtures, results, now);
if (dates.length === 0) {
  console.log("No pending fixtures past kickoff — nothing to sync.");
  setOutput("changed", "false");
  setOutput("entered", "");
  setOutput("alerts", "");
  process.exit(0);
}

console.log(`Pending fixtures past kickoff — querying ESPN dates: ${dates.join(", ")}`);
const events: EspnEvent[] = [];
for (const d of dates) events.push(...(await fetchEvents(d)));

const plan = planSync(fixtures, results, events, teams, now);

const enteredDescs: string[] = [];
if (plan.toEnter.length > 0) {
  const merged = results.filter((r) => !plan.toEnter.some((e) => e.result.match === r.match));
  merged.push(...plan.toEnter.map((e) => e.result));
  if (!dry) writeResults(merged);
  for (const { fixture, result } of plan.toEnter) {
    const desc = `match ${fixture.match} ${fixture.home} ${result.home_goals}-${result.away_goals} ${fixture.away}`;
    enteredDescs.push(desc);
    console.log(`\n${dry ? "[dry] would enter" : "Entered"} ${desc}`);
    printMatchPoints(fixture, result);
  }
} else {
  console.log("No new finished matches to enter.");
}

const alerts = [
  ...plan.conflicts.map((c) => `CONFLICT: ${c}`),
  ...plan.knockoutPending.map((k) => `KNOCKOUT PENDING: ${k}`),
  ...plan.unmapped.map((u) => `UNMAPPED: ${u}`),
  ...plan.overdue.map((o) => `OVERDUE: ${o}`),
];
for (const a of alerts) console.log(a);

setOutput("changed", String(!dry && plan.toEnter.length > 0));
setOutput("entered", enteredDescs.join("; "));
setOutput("alerts", alerts.join("; "));
