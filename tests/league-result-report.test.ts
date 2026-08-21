import { describe, expect, it } from "vitest";
import { leagueMatchPointReport } from "../lib/league-result-report";
import type {
  Fixture,
  MatchResult,
  PostLockScoringExclusion,
  PredictionFile,
} from "../lib/types";

const fixture: Fixture = {
  match: 3,
  stage: "md01",
  round: 1,
  espn_id: "401876487",
  home: "Stade Rennais",
  away: "Paris Saint-Germain",
  kickoff_utc: "2026-08-23T18:45:00Z",
  city: "Rennes",
  stadium: "Roazhon Park",
};
const result: MatchResult = { match: 3, status: "final", home_goals: 1, away_goals: 2 };
const files = new Map<string, PredictionFile[]>([
  [
    "test-model",
    [
      {
        model: "test/model",
        slug: "test-model",
        stage: "md01",
        prompt_version: "league-v1",
        params: {},
        requested_at: "2026-08-21T05:59:00Z",
        completed_at: "2026-08-21T06:00:00Z",
        attempts: 1,
        predictions: [{ match: 3, home_goals: 3, away_goals: 1 }],
      },
    ],
  ],
]);
const exclusion: PostLockScoringExclusion = {
  match: 3,
  espn_id: "401876487",
  classification: "post_lock_home_away_reversal",
  locked_fixture: {
    home: "Paris Saint-Germain",
    away: "Stade Rennais",
    city: "Paris",
    stadium: "Parc des Princes",
  },
  reason: "Fixture reversed after lock.",
  decided_at: "2026-08-21T07:28:36.959Z",
};

describe("leagueMatchPointReport", () => {
  it("does not calculate or print points for a post-lock scoring exclusion", () => {
    expect(leagueMatchPointReport(files, fixture, result, exclusion)).toEqual({
      state: "archived-unscored",
      storedPicks: 1,
      message:
        "1 archived pick for Paris Saint-Germain vs Stade Rennais (as locked); excluded from scoring, no points calculated.",
    });
  });

  it("keeps the ordinary scored report unchanged for a scoreable fixture", () => {
    expect(leagueMatchPointReport(files, fixture, result)).toEqual({
      state: "scored",
      rows: [{ slug: "test-model", pts: 0, how: "3-1 (none)" }],
    });
  });
});
