import { matchdayNumber, roundLabel } from "./types";
import type { MatchdayKey, RosterModel } from "./types";

const DEFAULT_JOIN_ROUND: MatchdayKey = "md01";

/** First round in which a model is eligible for one league competition. */
export function leagueJoinRound(model: RosterModel, competitionId: string): MatchdayKey {
  return model.league_joined_round?.[competitionId] ?? DEFAULT_JOIN_ROUND;
}

/** Whether a model belongs in one competition's field for the given matchday. */
export function modelEligibleForLeagueRound(
  model: RosterModel,
  competitionId: string,
  round: MatchdayKey,
): boolean {
  const joined = matchdayNumber(leagueJoinRound(model, competitionId));
  const current = matchdayNumber(round);
  if (joined === undefined || current === undefined) {
    throw new Error(`Invalid league matchday key for ${model.id} in ${competitionId}`);
  }
  return current >= joined;
}

/** The pre-season field: only models eligible from Matchday 1 in this competition. */
export function leagueSeasonRoster(
  roster: RosterModel[],
  competitionId: string,
): RosterModel[] {
  return roster.filter((model) => leagueJoinRound(model, competitionId) === DEFAULT_JOIN_ROUND);
}

/** The exact model field the prediction runner may call for this round. */
export function leagueRosterForRound(
  roster: RosterModel[],
  competitionId: string,
  round: MatchdayKey,
): RosterModel[] {
  return roster.filter((model) => modelEligibleForLeagueRound(model, competitionId, round));
}

/** Human-readable participation start for profiles and cohort labels. */
export function leagueStartLabel(model: RosterModel, competitionId: string): string {
  const joined = leagueJoinRound(model, competitionId);
  return `${joined === DEFAULT_JOIN_ROUND ? "from" : "since"} ${roundLabel(joined)}`;
}
