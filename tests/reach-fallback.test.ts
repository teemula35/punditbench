import { describe, expect, it } from "vitest";
import { modelReach, scoreBracket } from "../lib/bracket-scoring";
import type { Fixture, MatchResult, PredictionFile } from "../lib/types";

const groupOnly: PredictionFile[] = [
  {
    model: "m", slug: "m", stage: "group", prompt_version: "v1", params: {},
    requested_at: "", completed_at: "", attempts: 1,
    predictions: [{ match: 1, home_goals: 1, away_goals: 0 }],
  },
];

describe("R32 reach fallback (group-derived qualifiers)", () => {
  it("uses the fallback only when no r32 simulation exists", () => {
    const fallback = new Set(["A", "B"]);
    expect(modelReach(groupOnly, fallback).byStage.get("r32")).toEqual(fallback);
    expect(modelReach(groupOnly).byStage.get("r32")).toBeUndefined();
  });

  it("r32 file wins over the fallback when present", () => {
    const withR32: PredictionFile[] = [
      ...groupOnly,
      {
        model: "m", slug: "m", stage: "r32", prompt_version: "sim-v1", params: {},
        requested_at: "", completed_at: "", attempts: 1,
        simulated_fixtures: [{ match: 73, home: "C", away: "D" }],
        predictions: [{ match: 73, home_goals: 1, away_goals: 0 }],
      },
    ];
    expect(modelReach(withR32, new Set(["A", "B"])).byStage.get("r32")).toEqual(new Set(["C", "D"]));
  });

  it("scoreBracket awards R32 advancement through the fallback", () => {
    const realFixtures: Fixture[] = [
      { match: 73, stage: "r32", home: "A", away: "X", kickoff_utc: "", city: "" },
    ];
    const score = scoreBracket(groupOnly, realFixtures, new Map<number, MatchResult>(), new Set(["A", "B"]));
    expect(score.advancement).toBe(1); // A reached r32 in both worlds; B did not appear in reality('s fixtures)
    expect(score.r32Correct).toBe(1);
  });
});
