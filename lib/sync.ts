/**
 * Results auto-sync planning — pure logic, no IO (scripts/sync-results.ts
 * fetches and writes; tests exercise this file directly).
 *
 * Source is ESPN's public scoreboard JSON (site.api.espn.com, league
 * "fifa.world") — ESPN is one of the two blessed sources in OPS.md. Mapping
 * to our fixtures is strict: an event must match a fixture on BOTH the
 * normalized team pair (via a small alias table for ESPN naming) and the
 * exact kickoff instant, otherwise it is reported as an alert, never guessed.
 *
 * Scope guard: only GROUP results are entered automatically. Knockout results
 * need the 90' score plus --advances/--note judgment (ET/pens), so finished
 * knockout matches are flagged for manual `npm run result` entry instead.
 * Already-recorded matches seen in a fetch are re-checked against ESPN — a
 * score mismatch raises a conflict alert and is never overwritten (corrections
 * stay human, per the incident runbook).
 */
import type { Fixture, MatchResult, Team } from "./types";

/** ESPN displayName (normalized) -> our canonical team name, where they differ. */
export const ESPN_ALIASES: Record<string, string> = {
  bosniaherzegovina: "Bosnia and Herzegovina",
  congodr: "DR Congo",
  czechia: "Czech Republic",
  turkiye: "Turkey",
};

/** Lowercase, strip diacritics and everything but a-z0-9. */
export function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Resolve an ESPN team name to our canonical name, or undefined if unknown. */
export function resolveTeamName(espnName: string, teams: Team[]): string | undefined {
  const norm = normalizeTeamName(espnName);
  const direct = teams.find((t) => normalizeTeamName(t.name) === norm);
  if (direct) return direct.name;
  return ESPN_ALIASES[norm];
}

export interface EspnEvent {
  id: string;
  /** Kickoff, ISO 8601 (ESPN serves e.g. "2026-06-11T19:00Z"). */
  date: string;
  home: string;
  away: string;
  home_score: number;
  away_score: number;
  completed: boolean;
  status: string; // e.g. "STATUS_FULL_TIME", "STATUS_SCHEDULED"
  detail: string; // e.g. "FT"
}

/** Defensive extraction from the scoreboard payload; throws on shape surprises. */
export function parseScoreboard(payload: unknown): EspnEvent[] {
  const events = (payload as { events?: unknown[] }).events;
  if (!Array.isArray(events)) throw new Error("ESPN scoreboard: missing events[]");
  return events.map((e) => {
    const ev = e as {
      id?: unknown;
      date?: unknown;
      competitions?: {
        competitors?: {
          homeAway?: string;
          score?: unknown;
          team?: { displayName?: unknown };
        }[];
        status?: { type?: { name?: unknown; completed?: unknown; detail?: unknown } };
      }[];
    };
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === "home");
    const away = comp?.competitors?.find((c) => c.homeAway === "away");
    const status = comp?.status?.type;
    if (!ev.id || typeof ev.date !== "string" || !home?.team?.displayName || !away?.team?.displayName) {
      throw new Error(`ESPN scoreboard: malformed event ${JSON.stringify(ev.id ?? "?")}`);
    }
    return {
      id: String(ev.id),
      date: ev.date,
      home: String(home.team.displayName),
      away: String(away.team.displayName),
      home_score: Number(home.score ?? NaN),
      away_score: Number(away.score ?? NaN),
      completed: status?.completed === true,
      status: String(status?.name ?? ""),
      detail: String(status?.detail ?? ""),
    };
  });
}

/** Statuses we accept as a finished match (alongside completed === true). */
const FINAL_STATUSES = new Set(["STATUS_FULL_TIME", "STATUS_FINAL"]);

/** A fixture only ESPN can know is finished this much later is worth an alarm. */
const OVERDUE_MS = 12 * 60 * 60 * 1000;
/** Kickoff instants must agree within a minute — anything else is a red flag. */
const KICKOFF_TOLERANCE_MS = 60 * 1000;

export interface SyncPlan {
  /** New group results to enter, with their fixtures (sorted by match). */
  toEnter: { fixture: Fixture; result: MatchResult }[];
  /** Recorded result disagrees with ESPN — never auto-corrected. */
  conflicts: string[];
  /** Finished knockout matches awaiting manual `npm run result` entry. */
  knockoutPending: string[];
  /** Events or fixtures the strict mapping refused to pair. */
  unmapped: string[];
  /** Pending fixtures long past kickoff with no finished ESPN event. */
  overdue: string[];
}

export function planSync(
  fixtures: Fixture[],
  results: MatchResult[],
  events: EspnEvent[],
  teams: Team[],
  now: Date,
): SyncPlan {
  const plan: SyncPlan = { toEnter: [], conflicts: [], knockoutPending: [], unmapped: [], overdue: [] };
  const resultByMatch = new Map(results.map((r) => [r.match, r]));
  const fixtureByPair = new Map(
    fixtures.map((f) => [`${normalizeTeamName(f.home)}|${normalizeTeamName(f.away)}`, f]),
  );

  const finishedFixtures = new Set<number>();
  const seen = new Set<string>();
  for (const ev of events) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);

    const home = resolveTeamName(ev.home, teams);
    const away = resolveTeamName(ev.away, teams);
    if (!home || !away) {
      plan.unmapped.push(`ESPN event ${ev.id} "${ev.home} vs ${ev.away}": unknown team name`);
      continue;
    }
    const fixture = fixtureByPair.get(`${normalizeTeamName(home)}|${normalizeTeamName(away)}`);
    if (!fixture) {
      plan.unmapped.push(`ESPN event ${ev.id} "${home} vs ${away}": no fixture with this pairing`);
      continue;
    }
    if (Math.abs(Date.parse(ev.date) - Date.parse(fixture.kickoff_utc)) > KICKOFF_TOLERANCE_MS) {
      plan.unmapped.push(
        `ESPN event ${ev.id} "${home} vs ${away}" kicks off ${ev.date}, fixture ${fixture.match} says ${fixture.kickoff_utc}`,
      );
      continue;
    }

    if (!ev.completed) continue;
    if (!FINAL_STATUSES.has(ev.status)) {
      plan.unmapped.push(
        `ESPN event ${ev.id} (match ${fixture.match}) completed with unexpected status ${ev.status}`,
      );
      continue;
    }
    if (!Number.isInteger(ev.home_score) || !Number.isInteger(ev.away_score)) {
      plan.unmapped.push(`ESPN event ${ev.id} (match ${fixture.match}) has no numeric score`);
      continue;
    }
    finishedFixtures.add(fixture.match);

    const existing = resultByMatch.get(fixture.match);
    if (existing) {
      // Audit pass: recorded result must agree with what ESPN shows now.
      if (
        existing.status === "final" &&
        (existing.home_goals !== ev.home_score || existing.away_goals !== ev.away_score)
      ) {
        plan.conflicts.push(
          `match ${fixture.match} ${fixture.home} vs ${fixture.away}: recorded ` +
            `${existing.home_goals}-${existing.away_goals}, ESPN says ${ev.home_score}-${ev.away_score}`,
        );
      }
      continue;
    }

    if (fixture.stage !== "group") {
      plan.knockoutPending.push(
        `match ${fixture.match} ${fixture.home} vs ${fixture.away} finished ` +
          `${ev.home_score}-${ev.away_score} (${ev.detail}) — knockout, enter manually with --advances`,
      );
      continue;
    }

    plan.toEnter.push({
      fixture,
      result: {
        match: fixture.match,
        status: "final",
        home_goals: ev.home_score,
        away_goals: ev.away_score,
      },
    });
  }

  for (const f of fixtures) {
    if (resultByMatch.has(f.match) || finishedFixtures.has(f.match)) continue;
    if (now.getTime() - Date.parse(f.kickoff_utc) > OVERDUE_MS) {
      plan.overdue.push(
        `match ${f.match} ${f.home} vs ${f.away} kicked off ${f.kickoff_utc} but ESPN shows no final result`,
      );
    }
  }

  plan.toEnter.sort((a, b) => a.fixture.match - b.fixture.match);
  return plan;
}

export interface LeagueSyncPlan {
  /** New league results to enter (sorted by match). */
  toEnter: { fixture: Fixture; result: MatchResult }[];
  /** Recorded result disagrees with ESPN, or a matched event's teams drifted. */
  conflicts: string[];
  /** Finished events the strict mapping refused to pair (unknown id, bad score). */
  unmapped: string[];
  /** Pending fixtures long past kickoff with no finished ESPN event. */
  overdue: string[];
}

/**
 * League variant of planSync. League fixtures are ingested from the same ESPN
 * feed results come from, so events map to fixtures by ESPN event id — exact,
 * and immune to kickoff reshuffles. There is no knockout branch: every league
 * result auto-enters. Team names are still cross-checked on a matched id as a
 * guard against feed weirdness; drift is a conflict, never a silent update.
 * Postponed matches simply go overdue until the next fixtures refresh moves
 * their kickoff into the future, which clears the alert.
 */
export function planLeagueSync(
  fixtures: Fixture[],
  results: MatchResult[],
  events: EspnEvent[],
  now: Date,
): LeagueSyncPlan {
  const plan: LeagueSyncPlan = { toEnter: [], conflicts: [], unmapped: [], overdue: [] };
  const resultByMatch = new Map(results.map((r) => [r.match, r]));
  const fixtureById = new Map(fixtures.filter((f) => f.espn_id).map((f) => [f.espn_id!, f]));

  const finishedFixtures = new Set<number>();
  const seen = new Set<string>();
  for (const ev of events) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    if (!ev.completed) continue;

    const fixture = fixtureById.get(ev.id);
    if (!fixture) {
      plan.unmapped.push(`ESPN event ${ev.id} "${ev.home} vs ${ev.away}": no fixture with this id`);
      continue;
    }
    if (
      normalizeTeamName(fixture.home) !== normalizeTeamName(ev.home) ||
      normalizeTeamName(fixture.away) !== normalizeTeamName(ev.away)
    ) {
      plan.conflicts.push(
        `match ${fixture.match} (espn ${ev.id}): stored ${fixture.home} vs ${fixture.away}, ` +
          `ESPN says ${ev.home} vs ${ev.away}`,
      );
      continue;
    }
    if (!FINAL_STATUSES.has(ev.status)) {
      plan.unmapped.push(
        `ESPN event ${ev.id} (match ${fixture.match}) completed with unexpected status ${ev.status}`,
      );
      continue;
    }
    if (!Number.isInteger(ev.home_score) || !Number.isInteger(ev.away_score)) {
      plan.unmapped.push(`ESPN event ${ev.id} (match ${fixture.match}) has no numeric score`);
      continue;
    }
    finishedFixtures.add(fixture.match);

    const existing = resultByMatch.get(fixture.match);
    if (existing) {
      if (
        existing.status === "final" &&
        (existing.home_goals !== ev.home_score || existing.away_goals !== ev.away_score)
      ) {
        plan.conflicts.push(
          `match ${fixture.match} ${fixture.home} vs ${fixture.away}: recorded ` +
            `${existing.home_goals}-${existing.away_goals}, ESPN says ${ev.home_score}-${ev.away_score}`,
        );
      }
      continue;
    }

    plan.toEnter.push({
      fixture,
      result: {
        match: fixture.match,
        status: "final",
        home_goals: ev.home_score,
        away_goals: ev.away_score,
      },
    });
  }

  for (const f of fixtures) {
    if (resultByMatch.has(f.match) || finishedFixtures.has(f.match)) continue;
    if (now.getTime() - Date.parse(f.kickoff_utc) > OVERDUE_MS) {
      plan.overdue.push(
        `match ${f.match} ${f.home} vs ${f.away} kicked off ${f.kickoff_utc} but ESPN shows no final result`,
      );
    }
  }

  plan.toEnter.sort((a, b) => a.fixture.match - b.fixture.match);
  return plan;
}

/**
 * ESPN scoreboard dates (YYYYMMDD) to query: for every pending fixture whose
 * kickoff has passed, its UTC date and the day before (ESPN buckets matchdays
 * by US Eastern time, so a 02:00Z kickoff lives on the previous ESPN date).
 */
export function datesToQuery(fixtures: Fixture[], results: MatchResult[], now: Date): string[] {
  const recorded = new Set(results.map((r) => r.match));
  const dates = new Set<string>();
  for (const f of fixtures) {
    if (recorded.has(f.match)) continue;
    const kickoff = Date.parse(f.kickoff_utc);
    if (kickoff > now.getTime()) continue;
    const day = new Date(kickoff);
    const prev = new Date(kickoff - 24 * 60 * 60 * 1000);
    for (const d of [prev, day]) {
      dates.add(
        `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`,
      );
    }
  }
  return [...dates].sort();
}
