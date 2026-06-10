import type {
  Breakdown,
  Fixture,
  MatchResult,
  MatchScore,
  ModelTotals,
  Prediction,
  PredictionFile,
  StageId,
} from "./types";
import { KNOCKOUT_STAGES } from "./types";

export const POINTS = { exact: 3, gd: 2, outcome: 1, advance: 1 } as const;

function sign(n: number): -1 | 0 | 1 {
  return n < 0 ? -1 : n > 0 ? 1 : 0;
}

export function isKnockout(stage: StageId): boolean {
  return KNOCKOUT_STAGES.includes(stage);
}

/**
 * Who does a prediction say advances? Explicit `advances` wins; otherwise the
 * predicted winner. Returns undefined for a predicted draw with no explicit pick
 * (invalid input — the validator prevents it, but scoring must not crash on it).
 */
export function predictedAdvancer(p: Prediction, fixture: Fixture): string | undefined {
  if (p.advances) return p.advances;
  if (p.home_goals > p.away_goals) return fixture.home;
  if (p.away_goals > p.home_goals) return fixture.away;
  return undefined;
}

/**
 * Score one prediction against one final result. D1 rules:
 * exact 3 / goal difference 2 / outcome 1 / else 0, +1 advance bonus in knockouts.
 * Returns null for voided matches (excluded from everything).
 * A missing prediction on a final match scores 0 but still counts as a scored match.
 */
export function scoreMatch(
  prediction: Prediction | undefined,
  result: MatchResult,
  fixture: Fixture,
): MatchScore | null {
  if (result.status === "voided") return null;
  if (result.home_goals === undefined || result.away_goals === undefined) return null;

  if (!prediction) {
    return { match: result.match, points: 0, breakdown: "missing", advance_bonus: 0 };
  }

  let breakdown: Breakdown = "none";
  let points = 0;

  const exact =
    prediction.home_goals === result.home_goals && prediction.away_goals === result.away_goals;
  const gdEqual =
    prediction.home_goals - prediction.away_goals === result.home_goals - result.away_goals;
  const outcomeEqual =
    sign(prediction.home_goals - prediction.away_goals) ===
    sign(result.home_goals - result.away_goals);

  if (exact) {
    breakdown = "exact";
    points = POINTS.exact;
  } else if (gdEqual) {
    breakdown = "gd";
    points = POINTS.gd;
  } else if (outcomeEqual) {
    breakdown = "outcome";
    points = POINTS.outcome;
  }

  let advance_bonus: 0 | 1 = 0;
  if (isKnockout(fixture.stage) && result.advances) {
    if (predictedAdvancer(prediction, fixture) === result.advances) {
      advance_bonus = 1;
      points += POINTS.advance;
    }
  }

  return { match: result.match, points, breakdown, advance_bonus };
}

/** All scores for one model across all stages it predicted. */
export function scoreModel(
  files: PredictionFile[],
  fixturesByMatch: Map<number, Fixture>,
  resultsByMatch: Map<number, MatchResult>,
): Map<number, MatchScore> {
  const out = new Map<number, MatchScore>();
  for (const file of files) {
    const byMatch = new Map(file.predictions.map((p) => [p.match, p]));
    for (const [matchNo, fixture] of fixturesByMatch) {
      if (fixture.stage !== file.stage) continue;
      const result = resultsByMatch.get(matchNo);
      if (!result) continue;
      const s = scoreMatch(byMatch.get(matchNo), result, fixture);
      if (s) out.set(matchNo, s);
    }
  }
  return out;
}

export function totalsFor(
  slug: string,
  scores: Map<number, MatchScore>,
  fixturesByMatch: Map<number, Fixture>,
): ModelTotals {
  const t: ModelTotals = {
    slug,
    points: 0,
    exact: 0,
    gd: 0,
    outcome: 0,
    advances: 0,
    scoredMatches: 0,
    matchesWithPoints: 0,
    perStage: {},
  };
  for (const [matchNo, s] of scores) {
    const stage = fixturesByMatch.get(matchNo)?.stage;
    t.points += s.points;
    t.scoredMatches += 1;
    if (s.points > 0) t.matchesWithPoints += 1;
    if (s.breakdown === "exact") t.exact += 1;
    if (s.breakdown === "gd") t.gd += 1;
    if (s.breakdown === "outcome") t.outcome += 1;
    t.advances += s.advance_bonus;
    if (stage) t.perStage[stage] = (t.perStage[stage] ?? 0) + s.points;
  }
  return t;
}

/** D1 tiebreakers: points → exacts → matches with points → advance hits → shared rank. */
export function compareTotals(a: ModelTotals, b: ModelTotals): number {
  return (
    b.points - a.points ||
    b.exact - a.exact ||
    b.matchesWithPoints - a.matchesWithPoints ||
    b.advances - a.advances
  );
}

/** Dense ranking with shared positions for full ties. */
export function rank(totals: ModelTotals[]): { rank: number; totals: ModelTotals }[] {
  const sorted = [...totals].sort(compareTotals);
  const out: { rank: number; totals: ModelTotals }[] = [];
  let lastRank = 0;
  for (let i = 0; i < sorted.length; i++) {
    const tiedWithPrev = i > 0 && compareTotals(sorted[i - 1], sorted[i]) === 0;
    const r = tiedWithPrev ? lastRank : i + 1;
    out.push({ rank: r, totals: sorted[i] });
    lastRank = r;
  }
  return out;
}
