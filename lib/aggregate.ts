/**
 * Build-time aggregation shared by pages — methodology v2: leaderboard totals
 * are group match points (lib/scoring) plus bracket points (lib/bracket-scoring,
 * scored against the real knockout tournament once its fixtures exist), plus
 * per-match prediction tables, matchup calls, best calls, consensus and the
 * champion board. Pure derivation on top of lib/data.ts — nothing here is
 * ever stored.
 */
import { simulateGroups } from "./bracket";
import { modelReach, scoreBracket, type BracketScore } from "./bracket-scoring";
import {
  fixturesByMatch,
  loadAllLivePredictions,
  loadAllPredictions,
  loadLiveManifest,
  loadResults,
  loadRoster,
  loadTeams,
  resultsByMatch,
} from "./data";
import { computePersonalities, type Personality } from "./personality";
import { modelSlug } from "./prompt";
import { scoreMatch, scoreModel, totalsFor } from "./scoring";
import type {
  Fixture,
  LiveManifest,
  MatchResult,
  MatchScore,
  ModelTotals,
  Prediction,
  PredictionFile,
  RosterModel,
} from "./types";
import { KNOCKOUT_STAGES } from "./types";

export interface LeaderboardEntry {
  model: RosterModel;
  slug: string;
  /** Group-stage match points only (the bracket component lives in `bracket`). */
  totals: ModelTotals;
  /** Bracket points vs the real knockout tournament — all zeros until real knockout fixtures exist. */
  bracket: BracketScore;
  /** Leaderboard total: group match points + bracket points. */
  totalPoints: number;
  /** Exact scorelines: group matches + matched knockout pairings. */
  exactCount: number;
  /** The model's own predicted world champion, from its simulated final. */
  championPick?: string;
  rank: number;
  /** false → no prediction file stored yet ("predictions pending"). */
  hasPredictions: boolean;
  /** true once all six knockout-stage simulations are stored for this model. */
  bracketComplete: boolean;
  scores: Map<number, MatchScore>;
  files: PredictionFile[];
  /** Round-by-round (live) files: direct picks on the REAL knockout bracket. */
  liveFiles: PredictionFile[];
}

export interface SiteData {
  roster: RosterModel[];
  fixtures: Map<number, Fixture>;
  results: Map<number, MatchResult>;
  leaderboard: LeaderboardEntry[]; // sorted by rank, ties by label
  /** Prediction-style metrics per model slug (group stage; locked, never moves). */
  personalities: Map<string, Personality>;
  playedCount: number; // final, non-voided results
  totalFixtures: number;
  /** Round-by-round track: knockout match number -> reason it has no live pick. */
  liveExcluded: Map<number, string>;
  /** Round-by-round track: per-stage lock metadata (for "pre-registered" copy). */
  liveRounds: LiveManifest["rounds"];
}

/**
 * METHODOLOGY v2 leaderboard tiebreakers: total points → most exact scores →
 * correct champion → most correct Round-of-32 qualifiers → shared rank.
 */
function compareEntries(
  a: Pick<LeaderboardEntry, "totalPoints" | "exactCount" | "bracket">,
  b: Pick<LeaderboardEntry, "totalPoints" | "exactCount" | "bracket">,
): number {
  return (
    b.totalPoints - a.totalPoints ||
    b.exactCount - a.exactCount ||
    Number(b.bracket.championCorrect) - Number(a.bracket.championCorrect) ||
    b.bracket.r32Correct - a.bracket.r32Correct
  );
}

/** One full pass over the data; call once per page render (build time only). */
export function loadSiteData(): SiteData {
  const roster = [...loadRoster()].sort((a, b) => a.label.localeCompare(b.label));
  const fixtures = fixturesByMatch();
  const results = resultsByMatch();
  const allPredictions = loadAllPredictions();
  const allLivePredictions = loadAllLivePredictions();
  const liveManifest = loadLiveManifest();
  const realKnockoutFixtures = [...fixtures.values()].filter((f) => f.stage !== "group");
  const teams = loadTeams();
  const groupFixtures = [...fixtures.values()].filter((f) => f.stage === "group");

  const entries = roster.map((model): LeaderboardEntry => {
    const slug = modelSlug(model.id);
    const files = allPredictions.get(slug) ?? [];
    // Group matches are scored directly; knockout files are scored ONLY via
    // the bracket component (their match numbers are structural slots in the
    // model's own simulated tournament, not claims about real fixtures).
    const scores = scoreModel(
      files.filter((f) => f.stage === "group"),
      fixtures,
      results,
    );
    const totals = totalsFor(slug, scores, fixtures);
    // R32 reach is fully determined by the group predictions; models whose
    // r32 prompt failed keep the qualification credit their group answers
    // locked in (METHODOLOGY v2).
    const groupFile = files.find((f) => f.stage === "group");
    let r32Fallback: Set<string> | undefined;
    if (groupFile && !files.some((f) => f.stage === "r32" && f.simulated_fixtures)) {
      const sim = simulateGroups(groupFile, teams, groupFixtures);
      r32Fallback = new Set([
        ...[...sim.tables.values()].flatMap((t) => [t[0].team, t[1].team]),
        ...sim.thirdsRanked.slice(0, 8).map((r) => r.team),
      ]);
    }
    const bracket = scoreBracket(files, realKnockoutFixtures, results, r32Fallback);

    // Exact scorelines on matched knockout pairings count toward the
    // exact-scores tiebreaker (methodology v2: "most exact scores").
    let bracketExacts = 0;
    for (const fixture of realKnockoutFixtures) {
      const result = results.get(fixture.match);
      if (!result || result.status !== "final") continue;
      const matched = matchedSimPairing(files, fixture);
      if (!matched?.prediction) continue;
      const s = scoreMatch(matched.prediction, result, fixture);
      if (s?.breakdown === "exact") bracketExacts++;
    }

    const championSet = modelReach(files).byStage.get("champion");
    return {
      model,
      slug,
      totals,
      bracket,
      totalPoints: totals.points + bracket.total,
      exactCount: totals.exact + bracketExacts,
      championPick: championSet && championSet.size > 0 ? [...championSet][0] : undefined,
      rank: 0,
      hasPredictions: files.length > 0,
      bracketComplete: KNOCKOUT_STAGES.every((s) => files.some((f) => f.stage === s)),
      scores,
      files,
      liveFiles: allLivePredictions.get(slug) ?? [],
    };
  });

  // Dense ranking with shared positions for full ties (v2 comparator).
  const sorted = [...entries].sort(compareEntries);
  let lastRank = 0;
  sorted.forEach((e, i) => {
    e.rank = i > 0 && compareEntries(sorted[i - 1], e) === 0 ? lastRank : i + 1;
    lastRank = e.rank;
  });
  entries.sort((a, b) => a.rank - b.rank || a.model.label.localeCompare(b.model.label));

  const playedCount = loadResults().filter((r) => r.status === "final").length;
  const personalities = computePersonalities(allPredictions, groupFixtures);

  return {
    roster,
    fixtures,
    results,
    leaderboard: entries,
    personalities,
    playedCount,
    totalFixtures: 104,
    liveExcluded: new Map(
      Object.entries(liveManifest.excluded).map(([m, reason]) => [Number(m), reason]),
    ),
    liveRounds: liveManifest.rounds,
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

/** Every roster model's prediction (and score, if played) for one GROUP fixture. */
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

/** Every roster model's direct round-by-round (live) pick for one knockout fixture. */
export function liveMatchRows(data: SiteData, fixture: Fixture): MatchPredictionRow[] {
  const result = data.results.get(fixture.match);
  const rows = data.leaderboard.map((entry) => {
    const file = entry.liveFiles.find((f) => f.stage === fixture.stage);
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

export type LiveState = "picks" | "excluded" | "pending";

export interface LiveMatchInfo {
  /**
   * "picks": the round's live picks were collected and this match is included;
   * "excluded": it had already kicked off when the round was collected;
   * "pending": the round has not been collected yet (or no live track at all).
   */
  state: LiveState;
  rows: MatchPredictionRow[];
  excludedReason?: string;
  lockedAt?: string;
  modelsWithPick: number; // models with a valid live scoreline for this match
  modelsWithFile: number; // models with any live file for this round
}

/**
 * Round-by-round status for one fixture: whether the real-bracket live picks
 * exist for it, were deliberately excluded (already kicked off when the round
 * was collected), or are still pending. Group fixtures are never in this track.
 */
export function liveMatchInfo(data: SiteData, fixture: Fixture): LiveMatchInfo {
  if (fixture.stage === "group") {
    return { state: "pending", rows: [], modelsWithPick: 0, modelsWithFile: 0 };
  }
  const excludedReason = data.liveExcluded.get(fixture.match);
  if (excludedReason) {
    return { state: "excluded", excludedReason, rows: [], modelsWithPick: 0, modelsWithFile: 0 };
  }
  const roundRun = data.leaderboard.some((e) => e.liveFiles.some((f) => f.stage === fixture.stage));
  if (!roundRun) {
    return { state: "pending", rows: [], modelsWithPick: 0, modelsWithFile: 0 };
  }
  const rows = liveMatchRows(data, fixture);
  return {
    state: "picks",
    rows,
    lockedAt: data.liveRounds[fixture.stage]?.locked_at,
    modelsWithPick: rows.filter((r) => r.prediction).length,
    modelsWithFile: rows.filter((r) => r.fileExists).length,
  };
}

/**
 * A model's same-stage simulated pairing that matches a real knockout fixture
 * (order-insensitive), with its prediction oriented to the real fixture —
 * the same matching + orientation rules as lib/bracket-scoring.ts.
 * `prediction` is undefined when the pairing was simulated but the model
 * stored no valid scoreline for it.
 */
export function matchedSimPairing(
  files: PredictionFile[],
  fixture: Fixture,
): { simMatch: number; prediction?: Prediction } | undefined {
  if (fixture.stage === "group") return undefined;
  const file = files.find((f) => f.stage === fixture.stage);
  const sim = file?.simulated_fixtures?.find(
    (s) =>
      (s.home === fixture.home && s.away === fixture.away) ||
      (s.home === fixture.away && s.away === fixture.home),
  );
  if (!file || !sim) return undefined;
  const stored = file.predictions.find((p) => p.match === sim.match);
  if (!stored) return { simMatch: sim.match };

  const flipped = sim.home === fixture.away;
  const oriented: Prediction = flipped
    ? {
        match: fixture.match,
        home_goals: stored.away_goals,
        away_goals: stored.home_goals,
        ...(stored.advances ? { advances: stored.advances } : {}),
      }
    : { ...stored, match: fixture.match };
  // Implicit advancer must come from the SIMULATED pairing before flipping.
  if (!oriented.advances) {
    const adv =
      stored.home_goals > stored.away_goals
        ? sim.home
        : stored.away_goals > stored.home_goals
          ? sim.away
          : undefined;
    if (adv) oriented.advances = adv;
  }
  return { simMatch: sim.match, prediction: oriented };
}

export interface MatchupCall {
  entry: LeaderboardEntry;
  /** Predicted scoreline oriented to the real fixture; undefined → pairing called, no valid scoreline. */
  prediction?: Prediction;
  score: MatchScore | null; // null until the real match is played
}

/**
 * "Who called this matchup?" — models whose own simulated bracket contained
 * this real knockout pairing in the same stage, with their predicted
 * scorelines (and points once the match is played).
 */
export function matchupCalls(data: SiteData, fixture: Fixture): MatchupCall[] {
  if (fixture.stage === "group") return [];
  const result = data.results.get(fixture.match);
  const calls: MatchupCall[] = [];
  for (const entry of data.leaderboard) {
    const matched = matchedSimPairing(entry.files, fixture);
    if (!matched) continue;
    const score =
      result && matched.prediction ? scoreMatch(matched.prediction, result, fixture) : null;
    calls.push({ entry, prediction: matched.prediction, score });
  }
  const played = result?.status === "final";
  calls.sort((a, b) =>
    played
      ? (b.score?.points ?? -1) - (a.score?.points ?? -1) ||
        a.entry.model.label.localeCompare(b.entry.model.label)
      : a.entry.model.label.localeCompare(b.entry.model.label),
  );
  return calls;
}

export interface BestCall {
  label: string;
  slug: string;
  prediction: Prediction;
  points: number;
  tiedWith: number; // how many other models share the top score
}

/**
 * Highest-scoring prediction for a played match; undefined if nobody scored.
 * Group matches use direct predictions; knockouts use matched simulated
 * pairings (a model only scores a knockout scoreline if it called the pairing).
 */
export function bestCall(data: SiteData, fixture: Fixture): BestCall | undefined {
  const result = data.results.get(fixture.match);
  if (!result || result.status !== "final") return undefined;
  const candidates: BestCall[] =
    fixture.stage === "group"
      ? data.leaderboard.flatMap((entry) => {
          const prediction = predictionFor(entry, fixture);
          if (!prediction) return [];
          const s = scoreMatch(prediction, result, fixture);
          return s && s.points > 0
            ? [{ label: entry.model.label, slug: entry.slug, prediction, points: s.points, tiedWith: 0 }]
            : [];
        })
      : matchupCalls(data, fixture).flatMap((c) =>
          c.prediction && c.score && c.score.points > 0
            ? [
                {
                  label: c.entry.model.label,
                  slug: c.entry.slug,
                  prediction: c.prediction,
                  points: c.score.points,
                  tiedWith: 0,
                },
              ]
            : [],
        );
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));
  const best = candidates[0];
  best.tiedWith = candidates.filter((c) => c.points === best.points).length - 1;
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

export interface ChampionPick {
  team: string;
  models: { label: string; slug: string }[];
}

export interface OutcomeSplit {
  home: number;
  draw: number;
  away: number;
  outOf: number; // models with a stored prediction for this fixture
}

/**
 * How the models split on one fixture's outcome (home win / draw / away win),
 * counted over every stored direct prediction. Meaningful for GROUP fixtures
 * only — knockout prediction match numbers are structural slots in each
 * model's own simulated bracket (use matchupCalls there instead).
 */
export function outcomeSplit(data: SiteData, fixture: Fixture): OutcomeSplit | undefined {
  const split: OutcomeSplit = { home: 0, draw: 0, away: 0, outOf: 0 };
  for (const entry of data.leaderboard) {
    const p = predictionFor(entry, fixture);
    if (!p) continue;
    split.outOf++;
    if (p.home_goals > p.away_goals) split.home++;
    else if (p.home_goals < p.away_goals) split.away++;
    else split.draw++;
  }
  return split.outOf === 0 ? undefined : split;
}

/** Every stored champion pick, grouped by team, most popular first. */
export function championBoard(data: SiteData): ChampionPick[] {
  const byTeam = new Map<string, { label: string; slug: string }[]>();
  for (const e of data.leaderboard) {
    if (!e.championPick) continue;
    const list = byTeam.get(e.championPick) ?? [];
    list.push({ label: e.model.label, slug: e.slug });
    byTeam.set(e.championPick, list);
  }
  return [...byTeam.entries()]
    .map(([team, models]) => ({ team, models }))
    .sort((a, b) => b.models.length - a.models.length || a.team.localeCompare(b.team));
}
