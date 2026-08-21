import { scoreMatch } from "./scoring";
import type {
  Fixture,
  MatchResult,
  PostLockScoringExclusion,
  PredictionFile,
} from "./types";

export interface LeaguePointRow {
  slug: string;
  pts: number;
  how: string;
}

export type LeagueMatchPointReport =
  | { state: "scored"; rows: LeaguePointRow[] }
  | { state: "archived-unscored"; storedPicks: number; message: string };

/**
 * Build the results-sync console report without ever mapping an archived pick
 * onto a corrected fixture orientation.
 */
export function leagueMatchPointReport(
  predictions: Map<string, PredictionFile[]>,
  fixture: Fixture,
  result: MatchResult,
  scoringExclusion?: PostLockScoringExclusion,
): LeagueMatchPointReport {
  if (scoringExclusion) {
    let storedPicks = 0;
    for (const files of predictions.values()) {
      const file = files.find((candidate) => candidate.stage === fixture.stage);
      if (file?.predictions.some((prediction) => prediction.match === fixture.match)) storedPicks++;
    }
    const noun = storedPicks === 1 ? "pick" : "picks";
    return {
      state: "archived-unscored",
      storedPicks,
      message:
        `${storedPicks} archived ${noun} for ${scoringExclusion.locked_fixture.home} vs ` +
        `${scoringExclusion.locked_fixture.away} (as locked); excluded from scoring, no points calculated.`,
    };
  }

  const rows: LeaguePointRow[] = [];
  for (const [slug, files] of predictions) {
    const file = files.find((candidate) => candidate.stage === fixture.stage);
    const prediction = file?.predictions.find((candidate) => candidate.match === fixture.match);
    const score = scoreMatch(prediction, result, fixture);
    if (!score) continue;
    rows.push({
      slug,
      pts: score.points,
      how: prediction
        ? `${prediction.home_goals}-${prediction.away_goals} (${score.breakdown})`
        : "no prediction",
    });
  }
  rows.sort((a, b) => b.pts - a.pts || a.slug.localeCompare(b.slug));
  return { state: "scored", rows };
}
