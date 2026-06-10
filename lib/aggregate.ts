/**
 * Build-time aggregation shared by pages: leaderboard assembly, per-match
 * prediction tables, best calls and consensus. Pure derivation on top of
 * lib/data.ts + lib/scoring.ts — nothing here is ever stored.
 */
import {
  fixturesByMatch,
  loadAllPredictions,
  loadResults,
  loadRoster,
  resultsByMatch,
} from "./data";
import { modelSlug } from "./prompt";
import { rank, scoreMatch, scoreModel, totalsFor } from "./scoring";
import type {
  Fixture,
  MatchResult,
  MatchScore,
  ModelTotals,
  Prediction,
  PredictionFile,
  RosterModel,
} from "./types";

export interface LeaderboardEntry {
  model: RosterModel;
  slug: string;
  totals: ModelTotals;
  rank: number;
  /** false → no prediction file stored yet ("predictions pending"). */
  hasPredictions: boolean;
  scores: Map<number, MatchScore>;
  files: PredictionFile[];
}

export interface SiteData {
  roster: RosterModel[];
  fixtures: Map<number, Fixture>;
  results: Map<number, MatchResult>;
  leaderboard: LeaderboardEntry[]; // sorted by rank, ties by label
  playedCount: number; // final, non-voided results
  totalFixtures: number;
}

/** One full pass over the data; call once per page render (build time only). */
export function loadSiteData(): SiteData {
  const roster = [...loadRoster()].sort((a, b) => a.label.localeCompare(b.label));
  const fixtures = fixturesByMatch();
  const results = resultsByMatch();
  const allPredictions = loadAllPredictions();

  const entries = roster.map((model) => {
    const slug = modelSlug(model.id);
    const files = allPredictions.get(slug) ?? [];
    const scores = scoreModel(files, fixtures, results);
    return {
      model,
      slug,
      totals: totalsFor(slug, scores, fixtures),
      rank: 0,
      hasPredictions: files.length > 0,
      scores,
      files,
    };
  });

  const ranked = rank(entries.map((e) => e.totals));
  const rankBySlug = new Map(ranked.map((r) => [r.totals.slug, r.rank]));
  for (const e of entries) e.rank = rankBySlug.get(e.slug) ?? 0;
  entries.sort((a, b) => a.rank - b.rank || a.model.label.localeCompare(b.model.label));

  const playedCount = loadResults().filter((r) => r.status === "final").length;

  return {
    roster,
    fixtures,
    results,
    leaderboard: entries,
    playedCount,
    totalFixtures: 104,
  };
}

/** The model's stored prediction for one match, if any. */
export function predictionFor(entry: LeaderboardEntry, fixture: Fixture): Prediction | undefined {
  const file = entry.files.find((f) => f.stage === fixture.stage);
  return file?.predictions.find((p) => p.match === fixture.match);
}

export interface MatchPredictionRow {
  entry: LeaderboardEntry;
  /** undefined + fileExists=false → predictions pending; undefined + true → no valid prediction. */
  prediction: Prediction | undefined;
  fileExists: boolean;
  score: MatchScore | null; // null when match not played (or voided)
}

/** Every roster model's prediction (and score, if played) for one fixture. */
export function matchPredictionRows(data: SiteData, fixture: Fixture): MatchPredictionRow[] {
  const result = data.results.get(fixture.match);
  const rows = data.leaderboard.map((entry) => {
    const file = entry.files.find((f) => f.stage === fixture.stage);
    const prediction = file?.predictions.find((p) => p.match === fixture.match);
    const score = result ? scoreMatch(prediction, result, fixture) : null;
    return { entry, prediction, fileExists: Boolean(file), score };
  });
  if (result && result.status === "final") {
    rows.sort(
      (a, b) =>
        (b.score?.points ?? -1) - (a.score?.points ?? -1) ||
        a.entry.model.label.localeCompare(b.entry.model.label),
    );
  }
  return rows;
}

export interface BestCall {
  label: string;
  slug: string;
  prediction: Prediction;
  points: number;
  tiedWith: number; // how many other models share the top score
}

/** Highest-scoring prediction for a played match; undefined if nobody scored. */
export function bestCall(data: SiteData, fixture: Fixture): BestCall | undefined {
  const result = data.results.get(fixture.match);
  if (!result || result.status !== "final") return undefined;
  let best: BestCall | undefined;
  let tied = 0;
  for (const entry of data.leaderboard) {
    const prediction = predictionFor(entry, fixture);
    if (!prediction) continue;
    const s = scoreMatch(prediction, result, fixture);
    if (!s || s.points <= 0) continue;
    if (!best || s.points > best.points) {
      best = { label: entry.model.label, slug: entry.slug, prediction, points: s.points, tiedWith: 0 };
      tied = 0;
    } else if (s.points === best.points) {
      tied++;
    }
  }
  if (best) best.tiedWith = tied;
  return best;
}

export interface Consensus {
  home: number;
  away: number;
  count: number;
  outOf: number;
}

/** Most common predicted scoreline among models that predicted this match. */
export function consensus(data: SiteData, fixture: Fixture): Consensus | undefined {
  const counts = new Map<string, number>();
  let outOf = 0;
  for (const entry of data.leaderboard) {
    const p = predictionFor(entry, fixture);
    if (!p) continue;
    outOf++;
    const key = `${p.home_goals}-${p.away_goals}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (outOf === 0) return undefined;
  const top = [...counts.entries()].sort(
    (a, b) =>
      b[1] - a[1] ||
      a[0].split("-").reduce((s, n) => s + Number(n), 0) -
        b[0].split("-").reduce((s, n) => s + Number(n), 0) ||
      a[0].localeCompare(b[0]),
  )[0];
  const [home, away] = top[0].split("-").map(Number);
  return { home, away, count: top[1], outOf };
}
