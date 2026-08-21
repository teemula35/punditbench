import { describe, expect, it } from "vitest";
import {
  loadCompetitionFixtures,
  loadCompetitionLiveManifest,
  loadCompetitionScoringExclusions,
} from "../lib/data";
import { leagueRoundFulfilment, loadLeagueData } from "../lib/league-aggregate";
import { validateScoringExclusions } from "../lib/league-scoring-exclusions";
import type { Fixture, LiveManifest } from "../lib/types";

const fixtures: Fixture[] = [
  {
    match: 3,
    stage: "md01",
    round: 1,
    espn_id: "401876487",
    home: "Current Home",
    away: "Current Away",
    kickoff_utc: "2026-08-23T18:45:00Z",
    city: "Current City",
    stadium: "Current Stadium",
  },
];
const manifest: LiveManifest = {
  excluded: {},
  rounds: { md01: { locked_at: "2026-08-21T06:47:26.356Z", models: 43, excluded: [] } },
};
const valid = {
  version: 1,
  exclusions: [
    {
      match: 3,
      espn_id: "401876487",
      classification: "post_lock_home_away_reversal",
      locked_fixture: {
        home: "Current Away",
        away: "Current Home",
        city: "Old City",
        stadium: "Old Stadium",
      },
      reason: "Fixture home/away was reversed after the lock input was frozen.",
      decided_at: "2026-08-21T07:28:36.959Z",
    },
  ],
};

describe("validateScoringExclusions", () => {
  it("accepts an additive reversal tied to the stable ESPN id and locked round", () => {
    expect(validateScoringExclusions(valid, fixtures, manifest)).toEqual(valid.exclusions);
  });

  it.each([
    ["unsupported version", { ...valid, version: 2 }, /version/i],
    ["wrong ESPN id", { ...valid, exclusions: [{ ...valid.exclusions[0], espn_id: "wrong" }] }, /ESPN/i],
    [
      "stale orientation",
      {
        ...valid,
        exclusions: [
          {
            ...valid.exclusions[0],
            locked_fixture: { ...valid.exclusions[0].locked_fixture, home: "Current Home" },
          },
        ],
      },
      /reverse/i,
    ],
  ])("rejects %s", (_name, body, message) => {
    expect(() => validateScoringExclusions(body, fixtures, manifest)).toThrow(message);
  });

  it("rejects overlap with manifest exclusions", () => {
    const excludedManifest: LiveManifest = { ...manifest, excluded: { "3": "no picks" } };
    expect(() => validateScoringExclusions(valid, fixtures, excludedManifest)).toThrow(/manifest/i);
  });

  it("rejects duplicate match or ESPN identities", () => {
    const duplicate = { ...valid, exclusions: [valid.exclusions[0], { ...valid.exclusions[0] }] };
    expect(() => validateScoringExclusions(duplicate, fixtures, manifest)).toThrow(/duplicate/i);
  });
});

describe("competition scoring-exclusion data", () => {
  it("loads the corrected Rennes home fixture and its additive unscored classification", () => {
    const compId = "ligue1-2026-27";
    const actualFixtures = loadCompetitionFixtures(compId);
    const fixture = actualFixtures.find((entry) => entry.match === 3);
    expect(fixture).toMatchObject({
      espn_id: "401876487",
      home: "Stade Rennais",
      away: "Paris Saint-Germain",
      city: "Rennes",
      stadium: "Roazhon Park",
    });

    const exclusions = loadCompetitionScoringExclusions(
      compId,
      actualFixtures,
      loadCompetitionLiveManifest(compId),
    );
    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]).toMatchObject({
      match: 3,
      espn_id: "401876487",
      classification: "post_lock_home_away_reversal",
      locked_fixture: { home: "Paris Saint-Germain", away: "Stade Rennais" },
    });

    expect(leagueRoundFulfilment(loadLeagueData(compId), "md01")).toEqual({
      eligibleModels: 43,
      scoreableFixtures: 8,
      scoreableOpportunities: 344,
      validScoreablePicks: 344,
      missingScoreablePicks: 0,
      storedPicks: 387,
      archivedUnscoredPicks: 43,
    });
  });

  it("returns no exclusions for competitions without the additive file", () => {
    expect(
      loadCompetitionScoringExclusions(
        "epl-2026-27",
        loadCompetitionFixtures("epl-2026-27"),
        loadCompetitionLiveManifest("epl-2026-27"),
      ),
    ).toEqual([]);
  });
});
