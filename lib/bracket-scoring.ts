/**
 * Scoring v2, bracket component (self-consistent simulation design):
 *
 * - Advancement: for each REAL team reaching a stage, models whose simulated
 *   bracket also has that team reaching it score the stage weight.
 * - Matchup: a simulated pairing that actually occurs in the same real stage
 *   earns +1, and its predicted scoreline is then scored like a normal match
 *   (exact 3 / GD 2 / outcome 1, +1 correct advancer), orientation-normalized.
 *
 * Group-match scoring (lib/scoring.ts) is unchanged. Everything here derives
 * from primary data on every call — nothing stored.
 */
import { scoreMatch } from "./scoring";
import type { Fixture, MatchResult, Prediction, PredictionFile, StageId } from "./types";

export const ADVANCEMENT_POINTS: Record<string, number> = {
  r32: 1,
  r16: 2,
  qf: 3,
  sf: 5,
  final: 8,
  champion: 13,
};

export const MATCHUP_BONUS = 1;

/** Reach stages, in chain order (third place is not an advancement stage). */
const REACH_CHAIN: StageId[] = ["r32", "r16", "qf", "sf", "final"];

export interface ReachMap {
  /** stage -> set of team names that reach it; "champion" -> winner. */
  byStage: Map<string, Set<string>>;
}

/**
 * A model's reach map derives from its simulated files chain: stage-S reach =
 * teams in its stage-S pairings; S+1 reach = its stage-S `advances`. A model
 * that failed a later round keeps reach credit for everything its earlier
 * answers determine.
 *
 * `r32Fallback`: Round-of-32 reach is fully determined by the GROUP
 * predictions (the bracket computation needs no model input), so callers pass
 * the group-derived qualifier set for models whose r32 prompt failed — they
 * keep the qualification credit their group answers already locked in.
 */
export function modelReach(files: PredictionFile[], r32Fallback?: Set<string>): ReachMap {
  const byStage = new Map<string, Set<string>>();
  const fileFor = (stage: StageId) => files.find((f) => f.stage === stage);

  for (let i = 0; i < REACH_CHAIN.length; i++) {
    const stage = REACH_CHAIN[i];
    const file = fileFor(stage);
    if (file?.simulated_fixtures) {
      byStage.set(stage, new Set(file.simulated_fixtures.flatMap((f) => [f.home, f.away])));
    } else if (i === 0 && r32Fallback && r32Fallback.size > 0) {
      byStage.set(stage, r32Fallback);
    } else if (i > 0) {
      // Derive from the previous round's advances when this round wasn't
      // simulated; stages with neither a file nor a derivable previous round
      // simply stay unset — later stages with files still count.
      const prev = fileFor(REACH_CHAIN[i - 1]);
      if (!prev?.simulated_fixtures) continue;
      const advances = advancers(prev);
      if (advances.size > 0) byStage.set(stage, advances);
    }
  }

  const finalFile = fileFor("final");
  if (finalFile?.simulated_fixtures) {
    const adv = advancers(finalFile);
    if (adv.size === 1) byStage.set("champion", adv);
  }
  return { byStage };
}

function advancers(file: PredictionFile): Set<string> {
  const out = new Set<string>();
  const byMatch = new Map((file.simulated_fixtures ?? []).map((f) => [f.match, f]));
  for (const p of file.predictions) {
    const f = byMatch.get(p.match);
    if (!f) continue;
    const adv =
      p.advances ?? (p.home_goals > p.away_goals ? f.home : p.away_goals > p.home_goals ? f.away : undefined);
    if (adv) out.add(adv);
  }
  return out;
}

/**
 * Reality's reach map from real knockout fixtures + results. Teams reach a
 * stage when they appear in its real fixtures; champion = final's advancer.
 */
export function realReach(
  realFixtures: Fixture[],
  results: Map<number, MatchResult>,
): ReachMap {
  const byStage = new Map<string, Set<string>>();
  for (const stage of REACH_CHAIN) {
    const fixtures = realFixtures.filter((f) => f.stage === stage);
    if (fixtures.length === 0) continue;
    byStage.set(stage, new Set(fixtures.flatMap((f) => [f.home, f.away])));
  }
  const final = realFixtures.find((f) => f.stage === "final");
  const finalResult = final && results.get(final.match);
  if (finalResult?.status === "final" && finalResult.advances) {
    byStage.set("champion", new Set([finalResult.advances]));
  }
  return { byStage };
}

export interface BracketScore {
  advancement: number;
  matchupHits: number;
  matchupPoints: number; // scoreline points on matched pairings (incl. advance bonus)
  total: number;
  championCorrect: boolean;
  r32Correct: number;
  perStage: Map<string, { advancement: number; matchups: number; matchupPoints: number }>;
}

export function scoreBracket(
  files: PredictionFile[],
  realFixtures: Fixture[],
  results: Map<number, MatchResult>,
  r32Fallback?: Set<string>,
): BracketScore {
  const model = modelReach(files, r32Fallback);
  const real = realReach(realFixtures, results);

  const out: BracketScore = {
    advancement: 0,
    matchupHits: 0,
    matchupPoints: 0,
    total: 0,
    championCorrect: false,
    r32Correct: 0,
    perStage: new Map(),
  };
  const stageAcc = (s: string) => {
    if (!out.perStage.has(s)) out.perStage.set(s, { advancement: 0, matchups: 0, matchupPoints: 0 });
    return out.perStage.get(s)!;
  };

  // Advancement points.
  for (const [stage, weight] of Object.entries(ADVANCEMENT_POINTS)) {
    const realSet = real.byStage.get(stage);
    const modelSet = model.byStage.get(stage);
    if (!realSet || !modelSet) continue;
    for (const team of realSet) {
      if (modelSet.has(team)) {
        out.advancement += weight;
        stageAcc(stage).advancement += weight;
        if (stage === "r32") out.r32Correct++;
        if (stage === "champion") out.championCorrect = true;
      }
    }
  }

  // Matchup hits + scoreline points on matched pairings (incl. third place).
  const stages: StageId[] = ["r32", "r16", "qf", "sf", "third", "final"];
  for (const stage of stages) {
    const file = files.find((f) => f.stage === stage);
    if (!file?.simulated_fixtures) continue;
    const realStageFixtures = realFixtures.filter((f) => f.stage === stage);
    for (const realFixture of realStageFixtures) {
      const sim = file.simulated_fixtures.find(
        (s) =>
          (s.home === realFixture.home && s.away === realFixture.away) ||
          (s.home === realFixture.away && s.away === realFixture.home),
      );
      if (!sim) continue;
      out.matchupHits += MATCHUP_BONUS;
      stageAcc(stage).matchups += 1;

      const result = results.get(realFixture.match);
      if (!result || result.status !== "final") continue;
      const prediction = file.predictions.find((p) => p.match === sim.match);
      if (!prediction) continue;
      // Normalize orientation to the real fixture before scoring.
      const flipped = sim.home === realFixture.away;
      const oriented: Prediction = flipped
        ? {
            match: realFixture.match,
            home_goals: prediction.away_goals,
            away_goals: prediction.home_goals,
            ...(prediction.advances ? { advances: prediction.advances } : {}),
          }
        : { ...prediction, match: realFixture.match };
      // Implicit advancer must come from the SIMULATED pairing before flipping.
      if (!oriented.advances) {
        const adv =
          prediction.home_goals > prediction.away_goals
            ? sim.home
            : prediction.away_goals > prediction.home_goals
              ? sim.away
              : undefined;
        if (adv) oriented.advances = adv;
      }
      const s = scoreMatch(oriented, result, realFixture);
      if (s) {
        out.matchupPoints += s.points;
        stageAcc(stage).matchupPoints += s.points;
      }
    }
  }

  out.total = out.advancement + out.matchupHits + out.matchupPoints;
  return out;
}
