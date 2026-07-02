/**
 * League fixture ingest + refresh planning (pure logic — network/IO lives in
 * scripts/league-fixtures.ts). League fixtures are ingested FROM the same ESPN
 * feed that results-sync reads, so every fixture carries its ESPN event id and
 * results later match by id — no team-name alias problem like the WC had.
 *
 * Round assignment: ESPN's soccer scoreboard exposes no matchweek field, so
 * rounds are recovered structurally — within one matchday every team appears
 * exactly once. Sorting the season by kickoff and closing a round the moment a
 * team repeats reproduces the official matchweeks (including congested periods
 * like Boxing Day, where consecutive rounds are only a day or two apart).
 * Integrity checks against the competition config guard the result; rounds are
 * sticky after ingest — refreshes only update kickoffs/venues and flag drift.
 */
import type { Competition, Fixture } from "./types";
import { mdKey } from "./types";

/** Minimal shape of one ESPN scoreboard event for league ingest/refresh. */
export interface LeagueEvent {
  espn_id: string;
  kickoff_utc: string; // normalized ISO, e.g. "2026-08-21T19:00:00Z"
  home: string;
  away: string;
  city?: string;
  stadium?: string;
  statusName?: string; // e.g. "STATUS_SCHEDULED", "STATUS_FULL_TIME"
}

/** ESPN dates come as "2026-08-21T19:00Z" — normalize to seconds precision. */
export function normalizeEspnDate(d: string): string {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) throw new Error(`Unparseable ESPN date: ${d}`);
  return t.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Tolerant scoreboard parse: skips malformed events rather than throwing. */
export function parseLeagueScoreboard(json: unknown): LeagueEvent[] {
  const root = json as { events?: unknown[] };
  const out: LeagueEvent[] = [];
  for (const ev of root.events ?? []) {
    const e = ev as {
      id?: unknown;
      date?: unknown;
      status?: { type?: { name?: unknown } };
      competitions?: {
        venue?: { fullName?: unknown; address?: { city?: unknown } };
        competitors?: { homeAway?: unknown; team?: { displayName?: unknown } }[];
      }[];
    };
    const comp = e.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === "home")?.team?.displayName;
    const away = comp?.competitors?.find((c) => c.homeAway === "away")?.team?.displayName;
    if (typeof e.id !== "string" && typeof e.id !== "number") continue;
    if (typeof e.date !== "string" || typeof home !== "string" || typeof away !== "string") continue;
    let kickoff: string;
    try {
      kickoff = normalizeEspnDate(e.date);
    } catch {
      continue;
    }
    out.push({
      espn_id: String(e.id),
      kickoff_utc: kickoff,
      home,
      away,
      city: typeof comp?.venue?.address?.city === "string" ? comp.venue.address.city : undefined,
      stadium: typeof comp?.venue?.fullName === "string" ? comp.venue.fullName : undefined,
      statusName:
        typeof e.status?.type?.name === "string" ? (e.status.type.name as string) : undefined,
    });
  }
  return out;
}

/**
 * Group a season's events into rounds: iterate in kickoff order and close the
 * current round as soon as a team would appear in it twice.
 */
export function clusterRounds(events: LeagueEvent[]): LeagueEvent[][] {
  const sorted = [...events].sort(
    (a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.espn_id.localeCompare(b.espn_id),
  );
  const rounds: LeagueEvent[][] = [];
  let current: LeagueEvent[] = [];
  let seen = new Set<string>();
  for (const ev of sorted) {
    if (seen.has(ev.home) || seen.has(ev.away)) {
      rounds.push(current);
      current = [];
      seen = new Set();
    }
    current.push(ev);
    seen.add(ev.home);
    seen.add(ev.away);
  }
  if (current.length > 0) rounds.push(current);
  return rounds;
}

export interface IngestResult {
  fixtures: Fixture[];
  /** Integrity problems — when non-empty the ingest must not be written. */
  problems: string[];
}

/**
 * Initial season ingest: cluster into rounds, number matches sequentially
 * (round-major, kickoff order within a round), and verify the shape matches
 * the competition config exactly.
 */
export function ingestSeason(comp: Competition, events: LeagueEvent[]): IngestResult {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const ev of events) {
    if (ids.has(ev.espn_id)) problems.push(`Duplicate ESPN event id ${ev.espn_id}`);
    ids.add(ev.espn_id);
  }

  const rounds = clusterRounds(events);
  const matchesPerRound = comp.team_count / 2;
  const expectedTotal = comp.round_count * matchesPerRound;
  if (events.length !== expectedTotal) {
    problems.push(`Expected ${expectedTotal} fixtures for ${comp.id}, got ${events.length}`);
  }
  if (rounds.length !== comp.round_count) {
    problems.push(
      `Round clustering produced ${rounds.length} rounds, expected ${comp.round_count} — ` +
        `likely a fixture deferred from its original matchweek; assign rounds manually`,
    );
  }
  rounds.forEach((round, i) => {
    if (round.length !== matchesPerRound) {
      problems.push(`Round ${i + 1} has ${round.length} matches, expected ${matchesPerRound}`);
    }
  });
  const appearances = new Map<string, number>();
  for (const ev of events) {
    appearances.set(ev.home, (appearances.get(ev.home) ?? 0) + 1);
    appearances.set(ev.away, (appearances.get(ev.away) ?? 0) + 1);
  }
  if (appearances.size !== comp.team_count) {
    problems.push(`Found ${appearances.size} distinct teams, expected ${comp.team_count}`);
  }
  for (const [team, n] of appearances) {
    if (n !== comp.round_count) problems.push(`${team} appears in ${n} fixtures, expected ${comp.round_count}`);
  }

  const fixtures: Fixture[] = [];
  let match = 1;
  rounds.forEach((round, i) => {
    for (const ev of round) {
      fixtures.push({
        match: match++,
        stage: mdKey(i + 1),
        round: i + 1,
        home: ev.home,
        away: ev.away,
        kickoff_utc: ev.kickoff_utc,
        city: ev.city ?? "",
        ...(ev.stadium ? { stadium: ev.stadium } : {}),
        espn_id: ev.espn_id,
      });
    }
  });
  return { fixtures, problems };
}

export interface RefreshPlan {
  kickoffUpdates: { match: number; from: string; to: string }[];
  venueUpdates: { match: number; city?: string; stadium?: string }[];
  /** Team drift / events vanished from the feed — human decision required. */
  conflicts: string[];
  /** ESPN ids in the feed with no stored fixture — human decision required. */
  newEvents: LeagueEvent[];
}

/**
 * Plan a refresh of stored fixtures against a full re-fetch of the season.
 * Kickoffs and venues update freely (TV slots shuffle all season); teams and
 * rounds never change silently.
 */
export function planRefresh(fixtures: Fixture[], events: LeagueEvent[]): RefreshPlan {
  const plan: RefreshPlan = { kickoffUpdates: [], venueUpdates: [], conflicts: [], newEvents: [] };
  const byId = new Map(fixtures.map((f) => [f.espn_id ?? "", f]));
  const seen = new Set<string>();

  for (const ev of events) {
    const fixture = byId.get(ev.espn_id);
    if (!fixture) {
      plan.newEvents.push(ev);
      continue;
    }
    seen.add(ev.espn_id);
    if (fixture.home !== ev.home || fixture.away !== ev.away) {
      plan.conflicts.push(
        `Match ${fixture.match} (espn ${ev.espn_id}): teams changed ` +
          `${fixture.home} vs ${fixture.away} -> ${ev.home} vs ${ev.away}`,
      );
      continue;
    }
    if (fixture.kickoff_utc !== ev.kickoff_utc) {
      plan.kickoffUpdates.push({ match: fixture.match, from: fixture.kickoff_utc, to: ev.kickoff_utc });
    }
    const newCity = ev.city ?? "";
    const cityChanged = newCity !== "" && newCity !== fixture.city;
    const stadiumChanged = ev.stadium !== undefined && ev.stadium !== fixture.stadium;
    if (cityChanged || stadiumChanged) {
      plan.venueUpdates.push({
        match: fixture.match,
        ...(cityChanged ? { city: newCity } : {}),
        ...(stadiumChanged ? { stadium: ev.stadium } : {}),
      });
    }
  }

  for (const f of fixtures) {
    if (f.espn_id && !seen.has(f.espn_id)) {
      plan.conflicts.push(
        `Match ${f.match} (espn ${f.espn_id}, ${f.home} vs ${f.away}) missing from the feed`,
      );
    }
  }
  return plan;
}

/** Apply the non-conflicting parts of a refresh plan; returns a new array. */
export function applyRefresh(fixtures: Fixture[], plan: RefreshPlan): Fixture[] {
  const kickoffByMatch = new Map(plan.kickoffUpdates.map((u) => [u.match, u.to]));
  const venueByMatch = new Map(plan.venueUpdates.map((u) => [u.match, u]));
  return fixtures.map((f) => {
    const kickoff = kickoffByMatch.get(f.match);
    const venue = venueByMatch.get(f.match);
    if (!kickoff && !venue) return f;
    return {
      ...f,
      ...(kickoff ? { kickoff_utc: kickoff } : {}),
      ...(venue?.city !== undefined ? { city: venue.city } : {}),
      ...(venue?.stadium !== undefined ? { stadium: venue.stadium } : {}),
    };
  });
}
