/**
 * Due-round detection for the league round-by-round track (pure logic — the
 * predict-scheduler workflow and the league-predict script own all IO and
 * clock reads; `now` is always a parameter here).
 *
 * Rounds lock strictly in numeric matchday order: the next round to lock is
 * always the lowest-numbered matchday with no entry in the live manifest. A
 * round is "due" once its first kickoff is within LOCK_WINDOW_HOURS ahead of
 * now — or already in the past: a late scheduler run still locks the round,
 * and the predict script itself excludes matches that have already kicked
 * off (mirroring the WC R32 precedent). Because locking is keyed on the
 * manifest and not on kickoff times, a postponed match with a far-future
 * kickoff inside an already-locked round never resurfaces that round.
 */
import type { Fixture, LiveManifest, MatchdayKey } from "./types";
import { isMatchdayKey, matchdayNumber } from "./types";

/** How far ahead of a round's first kickoff its picks are collected. */
export const LOCK_WINDOW_HOURS = 36;

/**
 * Lowest-numbered matchday present in `fixtures` with no lock entry in
 * `manifest.rounds`; undefined when every round is locked or there are no
 * matchday fixtures. Comparison is numeric (md02 < md10), never string order.
 */
export function nextUnlockedRound(
  fixtures: Fixture[],
  manifest: LiveManifest,
): MatchdayKey | undefined {
  let bestKey: MatchdayKey | undefined;
  let bestNum = Infinity;
  for (const { stage } of fixtures) {
    if (!isMatchdayKey(stage)) continue; // WC stage keys are never league rounds
    if (stage in manifest.rounds) continue; // locked rounds never resurface
    const n = matchdayNumber(stage) ?? Infinity;
    if (n < bestNum) {
      bestNum = n;
      bestKey = stage;
    }
  }
  return bestKey;
}

/** Earliest kickoff_utc among the round's fixtures; undefined if it has none. */
export function roundFirstKickoff(fixtures: Fixture[], round: MatchdayKey): string | undefined {
  let first: string | undefined;
  let firstMs = Infinity;
  for (const f of fixtures) {
    if (f.stage !== round) continue;
    const ms = Date.parse(f.kickoff_utc);
    if (ms < firstMs) {
      firstMs = ms;
      first = f.kickoff_utc;
    }
  }
  return first;
}

/**
 * True when `round` is unlocked and its first kickoff is at most
 * `windowHours` ahead of `now` — including kickoffs already in the past
 * (late is still due; the predict script excludes started matches itself).
 */
export function isRoundDue(
  fixtures: Fixture[],
  manifest: LiveManifest,
  round: MatchdayKey,
  now: Date,
  windowHours = LOCK_WINDOW_HOURS,
): boolean {
  if (round in manifest.rounds) return false;
  const first = roundFirstKickoff(fixtures, round);
  if (first === undefined) return false;
  return Date.parse(first) <= now.getTime() + windowHours * 3_600_000;
}

/** One round the scheduler should lock on this run. */
export interface DueRound {
  compId: string;
  round: MatchdayKey;
  firstKickoff: string;
}

/**
 * Each competition's next unlocked round, if due — at most one round per
 * competition per call (the daily cadence picks up any backlog on later
 * runs). Sorted by first kickoff, soonest first.
 */
export function dueRounds(
  inputs: { compId: string; fixtures: Fixture[]; manifest: LiveManifest }[],
  now: Date,
  windowHours = LOCK_WINDOW_HOURS,
): DueRound[] {
  const out: DueRound[] = [];
  for (const { compId, fixtures, manifest } of inputs) {
    const round = nextUnlockedRound(fixtures, manifest);
    if (round === undefined) continue;
    if (!isRoundDue(fixtures, manifest, round, now, windowHours)) continue;
    const firstKickoff = roundFirstKickoff(fixtures, round);
    if (firstKickoff === undefined) continue; // unreachable: due implies a kickoff
    out.push({ compId, round, firstKickoff });
  }
  return out.sort((a, b) => Date.parse(a.firstKickoff) - Date.parse(b.firstKickoff));
}
