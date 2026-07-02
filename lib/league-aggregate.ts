/**
 * Build-time aggregation for the league competitions — the league mirror of
 * lib/aggregate.ts. One benchmark per competition: every roster model predicts
 * each matchday's real fixtures directly (form-aware round-by-round picks),
 * scored like group matches (exact 3 / goal difference 2 / outcome 1, no
 * advancer bonus). Pure derivation on top of lib/data.ts — nothing here is
 * ever stored.
 */
import {
  getCompetition,
  loadCompetitionFixtures,
  loadCompetitionLiveManifest,
  loadCompetitionLivePredictions,
  loadCompetitionResults,
  loadRoster,
} from "./data";
import { leagueTable } from "./league-context";
import { modelSlug } from "./prompt";
import { compareTotals, scoreMatch, scoreModel, totalsFor } from "./scoring";
import type { TableRow } from "./standings";
import { matchdayNumber } from "./types";
import type {
  Competition,
  Fixture,
  LiveManifest,
  MatchResult,
  MatchScore,
  ModelTotals,
  Prediction,
  PredictionFile,
  RosterModel,
} from "./types";

export interface LeagueLeaderboardEntry {
  model: RosterModel;
  slug: string;
  /** Direct match points on this competition's scored fixtures (lib/scoring). */
  totals: ModelTotals;
  /** Stored prediction entries across all locked rounds (0 → no picks yet). */
  picksCount: number;
  /** points / scoredMatches; 0 until the model has been scored on a match. */
  pointsPerMatch: number;
  rank: number;
}

export interface LeagueData {
  comp: Competition;
  fixtures: Map<number, Fixture>;
  results: Map<number, MatchResult>;
  manifest: LiveManifest;
  leaderboard: LeagueLeaderboardEntry[]; // sorted by rank, ties by label
  /** The real league table from synced results (all-zero rows pre-season). */
  table: TableRow[];
  playedCount: number; // final, non-voided results
  totalFixtures: number;
  /** slug -> stored round-by-round prediction files for this competition. */
  predictions: Map<string, PredictionFile[]>;
}

/**
 * League tiebreakers: D1 compareTotals (points → exacts → matches with points
 * → advance hits, always 0 here), then models with any stored picks rank above
 * models with none — a roster model that never locked a pick sits below every
 * participant, even 0-point ones.
 */
function compareEntries(a: LeagueLeaderboardEntry, b: LeagueLeaderboardEntry): number {
  return compareTotals(a.totals, b.totals) || Number(b.picksCount > 0) - Number(a.picksCount > 0);
}

/**
 * Pure assembly of one competition's site data from already-loaded inputs
 * (exported for tests; pages go through loadLeagueData). Matches listed in
 * manifest.excluded carry no pre-registered picks, so they are dropped from
 * scoring entirely — they never count toward any model's scored matches.
 */
export function assembleLeagueData(
  comp: Competition,
  roster: RosterModel[],
  fixtureList: Fixture[],
  resultList: MatchResult[],
  manifest: LiveManifest,
  predictions: Map<string, PredictionFile[]>,
): LeagueData {
  const sortedRoster = [...roster].sort((a, b) => a.label.localeCompare(b.label));
  const fixtures = new Map(fixtureList.map((f) => [f.match, f]));
  const results = new Map(resultList.map((r) => [r.match, r]));
  const scoringFixtures = new Map(
    [...fixtures].filter(([match]) => !(String(match) in manifest.excluded)),
  );

  const leaderboard = sortedRoster.map((model): LeagueLeaderboardEntry => {
    const slug = modelSlug(model.id);
    const files = predictions.get(slug) ?? [];
    const scores = scoreModel(files, scoringFixtures, results);
    const totals = totalsFor(slug, scores, scoringFixtures);
    return {
      model,
      slug,
      totals,
      picksCount: files.reduce((n, f) => n + f.predictions.length, 0),
      pointsPerMatch: totals.scoredMatches > 0 ? totals.points / totals.scoredMatches : 0,
      rank: 0,
    };
  });

  // Dense ranking with shared positions for full ties (mirrors lib/scoring rank()).
  const sorted = [...leaderboard].sort(compareEntries);
  let lastRank = 0;
  sorted.forEach((e, i) => {
    e.rank = i > 0 && compareEntries(sorted[i - 1], e) === 0 ? lastRank : i + 1;
    lastRank = e.rank;
  });
  leaderboard.sort((a, b) => a.rank - b.rank || a.model.label.localeCompare(b.model.label));

  return {
    comp,
    fixtures,
    results,
    manifest,
    leaderboard,
    table: leagueTable(fixtureList, resultList),
    playedCount: resultList.filter((r) => r.status === "final").length,
    totalFixtures: fixtureList.length,
    predictions,
  };
}

/** One full pass over one competition's data; call once per page render (build time only). */
export function loadLeagueData(compId: string): LeagueData {
  return assembleLeagueData(
    getCompetition(compId),
    loadRoster(),
    loadCompetitionFixtures(compId),
    loadCompetitionResults(compId),
    loadCompetitionLiveManifest(compId),
    loadCompetitionLivePredictions(compId),
  );
}

export type LeagueMatchState = "picks" | "excluded" | "pending";

export interface LeagueMatchRow {
  model: RosterModel;
  slug: string;
  /** undefined → no stored pick for this match (no valid pick, or no file for the round). */
  prediction?: Prediction;
  /** Set once the match is played and scoreable (a missing pick scores 0). */
  score?: MatchScore;
}

export interface LeagueMatchInfo {
  /**
   * "picks": the round's picks were locked and this match is included;
   * "excluded": the match carries no pre-registered picks (manifest.excluded);
   * "pending": the round has not been locked yet.
   */
  state: LeagueMatchState;
  rows: LeagueMatchRow[];
  excludedReason?: string;
  lockedAt?: string;
  /** Most common predicted scoreline among the picks (picks state only). */
  consensus?: { home: number; away: number; count: number; outOf: number };
  /** Home-win / draw / away-win split of the picks (picks state only). */
  split?: { home: number; draw: number; away: number; outOf: number };
}

/**
 * Round-by-round status for one league fixture, mirroring aggregate.ts
 * liveMatchInfo: excluded wins over everything, then locked rounds (per the
 * competition manifest, written at lock time) show their picks, and anything
 * else is pending. Rows cover the FULL roster, sorted by scored points then
 * slug (slug order pre-kickoff).
 */
export function leagueMatchInfo(data: LeagueData, fixture: Fixture): LeagueMatchInfo {
  const excludedReason = data.manifest.excluded[String(fixture.match)];
  if (excludedReason) {
    return { state: "excluded", excludedReason, rows: [] };
  }
  const lock = data.manifest.rounds[fixture.stage];
  if (!lock) {
    return { state: "pending", rows: [] };
  }

  const result = data.results.get(fixture.match);
  const rows: LeagueMatchRow[] = data.leaderboard.map(({ model, slug }) => {
    const file = data.predictions.get(slug)?.find((f) => f.stage === fixture.stage);
    const prediction = file?.predictions.find((p) => p.match === fixture.match);
    const score = result ? (scoreMatch(prediction, result, fixture) ?? undefined) : undefined;
    return { model, slug, prediction, score };
  });
  rows.sort(
    (a, b) => (b.score?.points ?? -1) - (a.score?.points ?? -1) || a.slug.localeCompare(b.slug),
  );

  // Consensus (most common scoreline; ties → fewer total goals → lexicographic)
  // and the 1/X/2 outcome split — same rules as aggregate.ts liveConsensus/
  // liveOutcomeSplit, over every stored pick for this match.
  const counts = new Map<string, number>();
  const split = { home: 0, draw: 0, away: 0, outOf: 0 };
  for (const row of rows) {
    const p = row.prediction;
    if (!p) continue;
    split.outOf++;
    const key = `${p.home_goals}-${p.away_goals}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (p.home_goals > p.away_goals) split.home++;
    else if (p.home_goals < p.away_goals) split.away++;
    else split.draw++;
  }
  let consensus: LeagueMatchInfo["consensus"];
  if (split.outOf > 0) {
    const top = [...counts.entries()].sort(
      (a, b) =>
        b[1] - a[1] ||
        a[0].split("-").reduce((s, n) => s + Number(n), 0) -
          b[0].split("-").reduce((s, n) => s + Number(n), 0) ||
        a[0].localeCompare(b[0]),
    )[0];
    const [home, away] = top[0].split("-").map(Number);
    consensus = { home, away, count: top[1], outOf: split.outOf };
  }

  return {
    state: "picks",
    rows,
    lockedAt: lock.locked_at,
    consensus,
    split: split.outOf > 0 ? split : undefined,
  };
}

/** Fixtures grouped by matchday: kickoff order inside each round, rounds ascending. */
export function fixturesByRound(data: LeagueData): Map<number, Fixture[]> {
  const rounds = new Map<number, Fixture[]>();
  const ordered = [...data.fixtures.values()].sort(
    (a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.match - b.match,
  );
  for (const f of ordered) {
    const round = f.round ?? matchdayNumber(f.stage);
    if (round === undefined) continue;
    const list = rounds.get(round) ?? [];
    list.push(f);
    rounds.set(round, list);
  }
  return new Map([...rounds.entries()].sort((a, b) => a[0] - b[0]));
}

/** The next matchday still to complete: lowest round with an unresulted fixture. */
export function nextRound(data: LeagueData): { round: number; fixtures: Fixture[] } | undefined {
  for (const [round, fixtures] of fixturesByRound(data)) {
    if (fixtures.some((f) => !data.results.has(f.match))) return { round, fixtures };
  }
  return undefined;
}
