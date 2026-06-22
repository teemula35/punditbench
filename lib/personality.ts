/**
 * Prediction "personality" — style metrics derived purely from each model's
 * locked group-stage scorelines. These say nothing about whether a model is
 * RIGHT (that's the leaderboard); they characterise HOW it predicts.
 *
 * Everything is computed over the group stage only — the 72 fixtures every
 * model answered, so the numbers are strictly comparable across the field —
 * and entirely from the pre-registered predictions, so a personality is fixed
 * for the whole tournament and never moves with results.
 *
 * Two of the four traits are field-relative: "chalk" measures agreement with
 * the rest of the field, and "favourite bias" needs a notion of which side is
 * stronger. With no rankings in the team data, strength is derived endogenously
 * as each team's mean predicted goal difference across the whole field — a
 * "silicon power rating". So a favourite here is who the models collectively
 * make a favourite, not a bookmaker's.
 */
import type { Fixture, PredictionFile, Prediction } from "./types";

/** Minimum silicon-rating gap (in goals) for a fixture to have a clear favourite. */
export const FAVOURITE_MARGIN = 0.5;

export type Outcome = "home" | "draw" | "away";

export type TraitKey = "goalsPerGame" | "drawRate" | "chalkIndex" | "upsetRate";

export interface Personality {
  slug: string;
  /** Valid group predictions counted — the denominator for the rates. */
  predicted: number;
  /** Mean total goals (home + away) per predicted group match. */
  goalsPerGame: number;
  /** Share of predicted group matches called level [0..1]. */
  drawRate: number;
  /** Mean agreement with the REST of the field on the match outcome [0..1]; higher = chalk. */
  chalkIndex: number;
  /** Of fixtures with a clear favourite, the share predicted as an underdog win [0..1]; higher = loves an upset. */
  upsetRate: number;
  /** Fixtures with a clear favourite that this model predicted (denominator for upsetRate). */
  favMatches: number;
  /** Of those, how many it called as an underdog win. */
  upsetPicks: number;
  /** Within-field rank per trait, 1 = highest value (ties share the higher rank). */
  rank: Record<TraitKey, number>;
  /** Number of models with a personality (the field these ranks are taken over). */
  fieldSize: number;
}

const TRAITS: TraitKey[] = ["goalsPerGame", "drawRate", "chalkIndex", "upsetRate"];

function outcomeOf(p: Prediction): Outcome {
  return p.home_goals > p.away_goals ? "home" : p.home_goals < p.away_goals ? "away" : "draw";
}

function groupPredictions(
  files: PredictionFile[],
  byMatch: Map<number, Fixture>,
): { fixture: Fixture; prediction: Prediction }[] {
  const gf = files.find((f) => f.stage === "group");
  if (!gf) return [];
  const out: { fixture: Fixture; prediction: Prediction }[] = [];
  for (const p of gf.predictions) {
    const fixture = byMatch.get(p.match);
    if (fixture) out.push({ fixture, prediction: p });
  }
  return out;
}

/**
 * Each team's mean predicted goal difference across every model's group
 * predictions — a field-consensus power rating used only to decide which side
 * is the favourite in a given fixture.
 */
export function siliconRatings(
  allPredictions: Map<string, PredictionFile[]>,
  groupFixtures: Fixture[],
): Map<string, number> {
  const byMatch = new Map(groupFixtures.map((f) => [f.match, f]));
  const sum = new Map<string, number>();
  const count = new Map<string, number>();
  const add = (team: string, gd: number) => {
    sum.set(team, (sum.get(team) ?? 0) + gd);
    count.set(team, (count.get(team) ?? 0) + 1);
  };
  for (const files of allPredictions.values()) {
    for (const { fixture, prediction } of groupPredictions(files, byMatch)) {
      const gd = prediction.home_goals - prediction.away_goals;
      add(fixture.home, gd);
      add(fixture.away, -gd);
    }
  }
  const ratings = new Map<string, number>();
  for (const [team, s] of sum) ratings.set(team, s / (count.get(team) || 1));
  return ratings;
}

/**
 * Personalities for every model with at least one valid group prediction,
 * keyed by slug. Computed in one pass over the whole field because the chalk
 * and favourite traits are defined relative to it.
 */
export function computePersonalities(
  allPredictions: Map<string, PredictionFile[]>,
  groupFixtures: Fixture[],
): Map<string, Personality> {
  const byMatch = new Map(groupFixtures.map((f) => [f.match, f]));
  const ratings = siliconRatings(allPredictions, groupFixtures);

  // Per fixture, how the whole field split on the outcome — the basis for the
  // chalk trait (a model's agreement with everyone else).
  const fieldOutcome = new Map<number, Record<Outcome, number>>();
  for (const files of allPredictions.values()) {
    for (const { fixture, prediction } of groupPredictions(files, byMatch)) {
      const rec = fieldOutcome.get(fixture.match) ?? { home: 0, draw: 0, away: 0 };
      rec[outcomeOf(prediction)]++;
      fieldOutcome.set(fixture.match, rec);
    }
  }

  const out = new Map<string, Personality>();
  for (const [slug, files] of allPredictions) {
    const preds = groupPredictions(files, byMatch);
    if (preds.length === 0) continue;

    let goals = 0;
    let draws = 0;
    let chalkSum = 0;
    let chalkN = 0;
    let favMatches = 0;
    let upsetPicks = 0;

    for (const { fixture, prediction } of preds) {
      goals += prediction.home_goals + prediction.away_goals;
      const outcome = outcomeOf(prediction);
      if (outcome === "draw") draws++;

      // Chalk: share of the OTHER models that called the same outcome.
      const rec = fieldOutcome.get(fixture.match);
      if (rec) {
        const total = rec.home + rec.draw + rec.away;
        if (total > 1) {
          chalkSum += (rec[outcome] - 1) / (total - 1);
          chalkN++;
        }
      }

      // Favourite bias: on fixtures the field rates as clearly one-sided, did
      // the model back the underdog to win outright?
      const ratingGap = (ratings.get(fixture.home) ?? 0) - (ratings.get(fixture.away) ?? 0);
      if (Math.abs(ratingGap) >= FAVOURITE_MARGIN) {
        favMatches++;
        const underdogWin = ratingGap > 0 ? outcome === "away" : outcome === "home";
        if (underdogWin) upsetPicks++;
      }
    }

    out.set(slug, {
      slug,
      predicted: preds.length,
      goalsPerGame: goals / preds.length,
      drawRate: draws / preds.length,
      chalkIndex: chalkN > 0 ? chalkSum / chalkN : 0,
      upsetRate: favMatches > 0 ? upsetPicks / favMatches : 0,
      favMatches,
      upsetPicks,
      rank: { goalsPerGame: 0, drawRate: 0, chalkIndex: 0, upsetRate: 0 },
      fieldSize: 0,
    });
  }

  // Standard competition ranking per trait (1 = highest value; equal values
  // share the better rank). Done once the whole field is known.
  const all = [...out.values()];
  for (const trait of TRAITS) {
    for (const p of all) {
      p.rank[trait] = 1 + all.filter((q) => q[trait] > p[trait]).length;
    }
  }
  for (const p of all) p.fieldSize = all.length;

  return out;
}

/**
 * Coarse position of a trait within the field: +1 = top third (highest
 * values), -1 = bottom third, 0 = middle. Drives the one-word descriptors.
 */
export function traitBand(rank: number, fieldSize: number): -1 | 0 | 1 {
  if (fieldSize < 3) return 0;
  if (rank <= fieldSize / 3) return 1;
  if (rank > (2 * fieldSize) / 3) return -1;
  return 0;
}
