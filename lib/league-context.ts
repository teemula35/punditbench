/**
 * Form-aware league prompt context: current table + recent form per team,
 * computed deterministically from the competition's synced results. Everything
 * here is a pure function of (fixtures, results) except loadPreviousSeason,
 * which reads one optional per-competition JSON file.
 */
import fs from "node:fs";
import path from "node:path";
import type { Fixture, MatchResult } from "./types";
import type { TableRow } from "./standings";

/** Scoreable results by match number: status "final" (never voided) with both goals recorded. */
function finalScoresByMatch(results: MatchResult[]): Map<number, { home: number; away: number }> {
  const map = new Map<number, { home: number; away: number }>();
  for (const r of results) {
    if (r.status === "final" && r.home_goals !== undefined && r.away_goals !== undefined) {
      map.set(r.match, { home: r.home_goals, away: r.away_goals });
    }
  }
  return map;
}

/**
 * League table from final results joined to fixtures by match number. Every
 * team that appears in fixtures gets a row (all zeros until it has played).
 *
 * Tiebreak (v1): points → goal difference → goals for → team name. This is the
 * generic ordering only; league-specific rules (e.g. La Liga ranks head-to-head
 * before goal difference) are NOT implemented — the table is a documented
 * approximation for display/prompt purposes, not an official classification.
 */
export function leagueTable(fixtures: Fixture[], results: MatchResult[]): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const f of fixtures) {
    for (const team of [f.home, f.away]) {
      if (!rows.has(team)) {
        rows.set(team, { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
      }
    }
  }
  const scores = finalScoresByMatch(results);
  for (const f of fixtures) {
    const s = scores.get(f.match);
    if (!s) continue;
    const home = rows.get(f.home)!;
    const away = rows.get(f.away)!;
    home.played++; away.played++;
    home.gf += s.home; home.ga += s.away;
    away.gf += s.away; away.ga += s.home;
    if (s.home > s.away) { home.won++; away.lost++; home.points += 3; }
    else if (s.home < s.away) { away.won++; home.lost++; away.points += 3; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  }
  for (const row of rows.values()) row.gd = row.gf - row.ga;
  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team),
  );
}

/**
 * Last n finished matches per team, most recent kickoff first; teams with no
 * finished matches map to []. Entry format: "W 3-1 vs Coventry City (H)" /
 * "L 0-2 vs Arsenal (A)" — result letter AND scoreline from the team's own
 * perspective (goals for first, so "L 0-2 (A)" reads "lost nil-two away"),
 * then opponent name and (H)/(A) venue marker.
 */
export function formByTeam(fixtures: Fixture[], results: MatchResult[], n = 5): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of fixtures) {
    if (!out.has(f.home)) out.set(f.home, []);
    if (!out.has(f.away)) out.set(f.away, []);
  }
  const scores = finalScoresByMatch(results);
  const finished = fixtures
    .filter((f) => scores.has(f.match))
    .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc) || b.match - a.match);
  const letter = (gf: number, ga: number): "W" | "L" | "D" => (gf > ga ? "W" : gf < ga ? "L" : "D");
  for (const f of finished) {
    const s = scores.get(f.match)!;
    const home = out.get(f.home)!;
    if (home.length < n) home.push(`${letter(s.home, s.away)} ${s.home}-${s.away} vs ${f.away} (H)`);
    const away = out.get(f.away)!;
    if (away.length < n) away.push(`${letter(s.away, s.home)} ${s.away}-${s.home} vs ${f.home} (A)`);
  }
  return out;
}

/**
 * Whole days of rest before each roundFixtures team's match this round: the
 * floor of the gap between that fixture's kickoff and the team's most recent
 * FINISHED match (final result with both goals recorded) whose kickoff is
 * strictly earlier. A team with no prior finished match — a season opener — is
 * OMITTED (no entry), unlike formByTeam which keeps an empty array. Pure and
 * clock-free: every timestamp comes from differencing two kickoff_utc ISO
 * strings via new Date(iso).getTime(), never the wall clock, so the signal is
 * byte-identical for every model at lock time.
 */
export function restDaysByTeam(
  fixtures: Fixture[],
  results: MatchResult[],
  roundFixtures: Fixture[],
): Map<string, number> {
  const out = new Map<string, number>();
  const scores = finalScoresByMatch(results);
  const finished = fixtures
    .filter((f) => scores.has(f.match))
    .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc) || b.match - a.match);
  for (const rf of roundFixtures) {
    const kickoff = new Date(rf.kickoff_utc).getTime();
    for (const team of [rf.home, rf.away]) {
      // finished is newest-first, so the first match this team played strictly
      // before kickoff is its most recent one; no prior match → team omitted.
      const prev = finished.find(
        (f) => (f.home === team || f.away === team) && new Date(f.kickoff_utc).getTime() < kickoff,
      );
      if (!prev) continue;
      out.set(team, Math.floor((kickoff - new Date(prev.kickoff_utc).getTime()) / 86_400_000));
    }
  }
  return out;
}

/** Previous season's final table + promotions, for the pre-season (MD1) prompt. */
export interface PreviousSeason {
  season: string; // e.g. "2025-26"
  table: string[]; // final table, champion first
  promoted: string[]; // teams promoted into the season being predicted
  note?: string; // free-text caveat, rendered verbatim in the prompt
}

/**
 * data/competitions/<compId>/previous-season.json if present (sourced manually
 * from a verifiable feed; never generated). Follows the readJsonIfExists
 * pattern from lib/data.ts, but resolves process.cwd() per call so tests can
 * point it at a temporary working directory.
 */
export function loadPreviousSeason(compId: string): PreviousSeason | undefined {
  const p = path.join(process.cwd(), "data", "competitions", compId, "previous-season.json");
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf-8")) as PreviousSeason) : undefined;
}

/**
 * Summer transfer + injury context for the pre-season table prompt. Like
 * PreviousSeason it is sourced MANUALLY from a verifiable feed and never
 * generated — the season table is locked for pre-registration, so a hallucinated
 * transfer would poison every model's prompt identically. Both lists reach every
 * model (including the frozen legacy wing) through the shared prompt, so the
 * benchmark still measures reasoning over shared evidence.
 */
export interface PreseasonContext {
  as_of: string; // ISO date the notes were compiled — shown to models, not the clock
  transfers: string[]; // notable confirmed moves, one factual line each
  injuries: string[]; // players out/unavailable for the season start, one line each
  managers?: string[]; // confirmed summer managerial changes, one line each (optional)
  source?: string; // provenance for auditors; never model-facing (like PreviousSeason.note)
}

/**
 * data/competitions/<compId>/preseason-context.json if present. Same manual
 * provenance and per-call cwd resolution as loadPreviousSeason; absent for any
 * competition whose summer context has not been compiled yet (the season prompt
 * simply omits the block then).
 */
export function loadPreseasonContext(compId: string): PreseasonContext | undefined {
  const p = path.join(process.cwd(), "data", "competitions", compId, "preseason-context.json");
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf-8")) as PreseasonContext) : undefined;
}
