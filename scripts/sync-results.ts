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
import {
  activeCompetitions,
  loadAllPredictions,
  loadCompetitionFixtures,
  loadCompetitionLivePredictions,
  loadCompetitionResults,
  loadFixtures,
  loadResults,
  loadTeams,
  writeCompetitionResults,
  writeResults,
} from "../lib/data";
import { scoreMatch } from "../lib/scoring";
import {
  EXTRA_TIME_STATUSES,
  datesToQuery,
  parseScoreboard,
  parseSummaryScore90,
  planLeagueSync,
  planSync,
  type EspnEvent,
} from "../lib/sync";
import { roundLabel } from "../lib/types";
import type { Fixture, MatchResult } from "../lib/types";

const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";
const USER_AGENT = "punditbench-results-sync (https://github.com/teemula35/punditbench)";

const dry = process.argv.includes("--dry");

function setOutput(name: string, value: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  // Single-line values only — alerts are joined with "; ".
  fs.appendFileSync(out, `${name}=${value.replace(/\r?\n/g, " ")}\n`);
}

async function fetchEvents(scoreboard: string, date: string): Promise<EspnEvent[]> {
  const res = await fetch(`${scoreboard}?dates=${date}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`ESPN scoreboard ${date}: HTTP ${res.status}`);
  return parseScoreboard(await res.json());
}

/**
 * Extra-time finals: the scoreboard has no period scores, so pull each such
 * event's summary to derive the 90-minute score the benchmark records.
 */
async function attachScore90(events: EspnEvent[]): Promise<void> {
  const byId = new Map<string, { home_90: number; away_90: number } | undefined>();
  for (const e of events) {
    if (!e.completed || !EXTRA_TIME_STATUSES.has(e.status)) continue;
    if (!byId.has(e.id)) {
      let parsed: { home_90: number; away_90: number } | undefined;
      try {
        const res = await fetch(`${SUMMARY}?event=${e.id}`, { headers: { "User-Agent": USER_AGENT } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        parsed = parseSummaryScore90(await res.json());
        if (!parsed) console.log(`note: summary for event ${e.id} has no period linescores — 90' score unknown`);
      } catch (err) {
        console.log(`note: summary fetch failed for event ${e.id} (${(err as Error).message}) — 90' score unknown`);
      }
      byId.set(e.id, parsed);
    }
    const s = byId.get(e.id);
    if (s) {
      e.home_score_90 = s.home_90;
      e.away_score_90 = s.away_90;
    }
  }
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

/** League variant: points vs that competition's round-by-round live picks. */
function printLeagueMatchPoints(compId: string, fixture: Fixture, result: MatchResult): void {
  const rows: { slug: string; pts: number; how: string }[] = [];
  for (const [slug, files] of loadCompetitionLivePredictions(compId)) {
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

const now = new Date();
let anyChanged = false;
const allEntered: string[] = [];
const allAlerts: string[] = [];

// --- World Cup 2026 (original data tree) ---
{
  const fixtures = loadFixtures();
  const results = loadResults();
  const teams = loadTeams();
  const dates = datesToQuery(fixtures, results, now);
  if (dates.length === 0) {
    console.log("WC: no pending fixtures past kickoff.");
  } else {
    console.log(`WC: pending fixtures past kickoff — querying ESPN dates: ${dates.join(", ")}`);
    const events: EspnEvent[] = [];
    for (const d of dates) events.push(...(await fetchEvents(SCOREBOARD, d)));
    await attachScore90(events);

    const plan = planSync(fixtures, results, events, teams, now);
    if (plan.toEnter.length > 0) {
      const merged = results.filter((r) => !plan.toEnter.some((e) => e.result.match === r.match));
      merged.push(...plan.toEnter.map((e) => e.result));
      if (!dry) writeResults(merged);
      anyChanged = anyChanged || !dry;
      for (const { fixture, result } of plan.toEnter) {
        const desc = `match ${fixture.match} ${fixture.home} ${result.home_goals}-${result.away_goals} ${fixture.away}`;
        allEntered.push(desc);
        console.log(`\n${dry ? "[dry] would enter" : "Entered"} ${desc}`);
        printMatchPoints(fixture, result);
      }
    } else {
      console.log("WC: no new finished matches to enter.");
    }
    allAlerts.push(
      ...plan.conflicts.map((c) => `CONFLICT: ${c}`),
      ...plan.knockoutPending.map((k) => `KNOCKOUT PENDING: ${k}`),
      ...plan.unmapped.map((u) => `UNMAPPED: ${u}`),
      ...plan.overdue.map((o) => `OVERDUE: ${o}`),
    );
  }
}

// --- League competitions (active in data/competitions.json) ---
for (const comp of activeCompetitions()) {
  const fixtures = loadCompetitionFixtures(comp.id);
  const results = loadCompetitionResults(comp.id);
  const dates = datesToQuery(fixtures, results, now);
  if (dates.length === 0) {
    console.log(`${comp.short_name}: no pending fixtures past kickoff.`);
    continue;
  }
  console.log(`${comp.short_name}: querying ESPN dates: ${dates.join(", ")}`);
  const scoreboard = `https://site.api.espn.com/apis/site/v2/sports/soccer/${comp.espn_slug}/scoreboard`;
  const events: EspnEvent[] = [];
  for (const d of dates) events.push(...(await fetchEvents(scoreboard, d)));

  const plan = planLeagueSync(fixtures, results, events, now);
  if (plan.toEnter.length > 0) {
    const merged = results.filter((r) => !plan.toEnter.some((e) => e.result.match === r.match));
    merged.push(...plan.toEnter.map((e) => e.result));
    if (!dry) writeCompetitionResults(comp.id, merged);
    anyChanged = anyChanged || !dry;
    for (const { fixture, result } of plan.toEnter) {
      const desc =
        `${comp.short_name} ${roundLabel(fixture.stage)}: ` +
        `${fixture.home} ${result.home_goals}-${result.away_goals} ${fixture.away}`;
      allEntered.push(desc);
      console.log(`\n${dry ? "[dry] would enter" : "Entered"} ${desc}`);
      printLeagueMatchPoints(comp.id, fixture, result);
    }
  } else {
    console.log(`${comp.short_name}: no new finished matches to enter.`);
  }
  allAlerts.push(
    ...plan.conflicts.map((c) => `CONFLICT [${comp.short_name}]: ${c}`),
    ...plan.unmapped.map((u) => `UNMAPPED [${comp.short_name}]: ${u}`),
    ...plan.overdue.map((o) => `OVERDUE [${comp.short_name}]: ${o}`),
  );
}

for (const a of allAlerts) console.log(a);

setOutput("changed", String(anyChanged));
setOutput("entered", allEntered.join("; "));
setOutput("alerts", allAlerts.join("; "));
