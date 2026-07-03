/**
 * League fixture ingest + refresh from ESPN.
 *
 *   npm run league-fixtures -- --comp epl-2026-27 [--dry]
 *   npm run league-fixtures -- --all [--dry]
 *
 * First run for a competition ingests the whole season (round clustering +
 * integrity checks — refuses to write if the shape doesn't match the config).
 * Later runs refresh kickoff times/venues by ESPN event id and flag any team
 * drift, vanished events, or unknown new events as conflicts (exit 1 = human).
 */
import {
  getCompetition,
  loadCompetitionFixtures,
  loadCompetitions,
  writeCompetitionFixtures,
} from "../lib/data";
import {
  applyRefresh,
  ingestSeason,
  parseLeagueScoreboard,
  planRefresh,
  type LeagueEvent,
} from "../lib/league-fixtures";
import type { Competition } from "../lib/types";

const SCOREBOARD_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (flag: string): boolean => process.argv.includes(flag);

/** Season window: Jul 15 of the starting year to Jul 1 of the following year. */
function seasonWindow(comp: Competition): { start: Date; end: Date } {
  const startYear = Number(comp.season_label.slice(0, 4));
  if (!Number.isInteger(startYear)) throw new Error(`Bad season_label: ${comp.season_label}`);
  return { start: new Date(Date.UTC(startYear, 6, 15)), end: new Date(Date.UTC(startYear + 1, 6, 1)) };
}

const ymd = (d: Date): string => d.toISOString().slice(0, 10).replace(/-/g, "");

async function fetchChunk(slug: string, from: Date, to: Date): Promise<LeagueEvent[]> {
  const url = `${SCOREBOARD_BASE}/${slug}/scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=400`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseLeagueScoreboard(await res.json());
    } catch (err) {
      if (attempt >= 3) throw new Error(`${url}: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

/** Full-season fetch in ~30-day chunks, deduplicated by ESPN event id. */
async function fetchSeason(comp: Competition): Promise<LeagueEvent[]> {
  const { start, end } = seasonWindow(comp);
  const byId = new Map<string, LeagueEvent>();
  for (let from = new Date(start); from < end; ) {
    const to = new Date(Math.min(from.getTime() + 29 * 86400_000, end.getTime()));
    for (const ev of await fetchChunk(comp.espn_slug, from, to)) byId.set(ev.espn_id, ev);
    from = new Date(to.getTime() + 86400_000);
    await new Promise((r) => setTimeout(r, 300));
  }
  return [...byId.values()];
}

async function processCompetition(comp: Competition, dry: boolean): Promise<boolean> {
  console.log(`\n=== ${comp.name} (${comp.espn_slug}) ===`);
  const events = await fetchSeason(comp);
  console.log(`Feed: ${events.length} events`);
  if (events.length === 0) {
    console.log(`No fixtures in the feed yet — skipping (expected for ${comp.id}? see registry notes).`);
    return true;
  }

  const existing = loadCompetitionFixtures(comp.id);
  if (existing.length === 0) {
    const { fixtures, problems } = ingestSeason(comp, events);
    if (problems.length > 0) {
      // A never-ingested competition has no operational state to corrupt, and
      // ESPN publishes some seasons in tranches (Bundesliga 2026-27 appeared
      // as matchdays 1-19 first) — an incomplete feed pre-onboarding is
      // expected, not an alert. Ingest happens on the first clean validation.
      console.log(`NOT READY — ${comp.id} feed fails season validation (${problems.length} problem(s)); not ingesting yet:`);
      for (const p of problems) console.log(`  - ${p}`);
      return true;
    }
    const rounds = new Set(fixtures.map((f) => f.round)).size;
    console.log(
      `Ingest OK: ${fixtures.length} fixtures across ${rounds} rounds, ` +
        `${fixtures[0].kickoff_utc} -> ${fixtures[fixtures.length - 1].kickoff_utc}`,
    );
    if (!dry) {
      writeCompetitionFixtures(comp.id, fixtures);
      console.log(`Wrote data/competitions/${comp.id}/fixtures.json`);
    }
    return true;
  }

  const plan = planRefresh(existing, events);
  console.log(
    `Refresh: ${plan.kickoffUpdates.length} kickoff update(s), ${plan.venueUpdates.length} venue update(s), ` +
      `${plan.conflicts.length} conflict(s), ${plan.newEvents.length} unknown new event(s)`,
  );
  for (const u of plan.kickoffUpdates) console.log(`  kickoff m${u.match}: ${u.from} -> ${u.to}`);
  for (const c of plan.conflicts) console.error(`  CONFLICT: ${c}`);
  for (const ev of plan.newEvents) {
    console.error(`  NEW EVENT (not auto-added): espn ${ev.espn_id} ${ev.home} vs ${ev.away} @ ${ev.kickoff_utc}`);
  }
  if (!dry && (plan.kickoffUpdates.length > 0 || plan.venueUpdates.length > 0)) {
    writeCompetitionFixtures(comp.id, applyRefresh(existing, plan));
    console.log(`Wrote data/competitions/${comp.id}/fixtures.json`);
  }
  return plan.conflicts.length === 0 && plan.newEvents.length === 0;
}

async function main(): Promise<void> {
  const dry = has("--dry");
  const compId = arg("--comp");
  const comps = compId ? [getCompetition(compId)] : has("--all") ? loadCompetitions() : [];
  if (comps.length === 0) {
    console.error("Usage: league-fixtures --comp <id> [--dry] | --all [--dry]");
    process.exit(2);
  }
  let ok = true;
  for (const comp of comps) ok = (await processCompetition(comp, dry)) && ok;
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
