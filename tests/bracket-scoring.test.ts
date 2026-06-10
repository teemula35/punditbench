import { describe, expect, it } from "vitest";
import { modelReach, realReach, scoreBracket } from "../lib/bracket-scoring";
import type { Fixture, MatchResult, PredictionFile } from "../lib/types";

const simFile = (
  stage: PredictionFile["stage"],
  fixtures: { match: number; home: string; away: string }[],
  predictions: PredictionFile["predictions"],
): PredictionFile => ({
  model: "m", slug: "m", stage, prompt_version: "sim-v1", params: {},
  requested_at: "", completed_at: "", attempts: 1,
  simulated_fixtures: fixtures, predictions,
});

const realFixture = (match: number, stage: Fixture["stage"], home: string, away: string): Fixture => ({
  match, stage, home, away, kickoff_utc: "2026-07-01T00:00:00Z", city: "X",
});

describe("modelReach", () => {
  it("derives reach from pairings and advances, surviving a failed later round", () => {
    const files = [
      simFile("r32", [{ match: 73, home: "A", away: "B" }, { match: 74, home: "C", away: "D" }], [
        { match: 73, home_goals: 2, away_goals: 0 },
        { match: 74, home_goals: 1, away_goals: 1, advances: "D" },
      ]),
      // r16 file missing (failed run) — r16 reach must still derive from r32 advances.
    ];
    const reach = modelReach(files);
    expect(reach.byStage.get("r32")).toEqual(new Set(["A", "B", "C", "D"]));
    expect(reach.byStage.get("r16")).toEqual(new Set(["A", "D"]));
    expect(reach.byStage.get("qf")).toBeUndefined(); // chain stops without r16 answers
  });

  it("derives champion from the final's advancer", () => {
    const files = [
      simFile("final", [{ match: 104, home: "A", away: "B" }], [
        { match: 104, home_goals: 1, away_goals: 1, advances: "B" },
      ]),
    ];
    expect(modelReach(files).byStage.get("champion")).toEqual(new Set(["B"]));
  });
});

describe("realReach", () => {
  it("reads reach from real fixtures and champion from the final result", () => {
    const fixtures = [
      realFixture(73, "r32", "A", "B"),
      realFixture(104, "final", "A", "C"),
    ];
    const results = new Map<number, MatchResult>([
      [104, { match: 104, status: "final", home_goals: 0, away_goals: 0, advances: "C" }],
    ]);
    const reach = realReach(fixtures, results);
    expect(reach.byStage.get("r32")).toEqual(new Set(["A", "B"]));
    expect(reach.byStage.get("champion")).toEqual(new Set(["C"]));
  });
});

describe("scoreBracket", () => {
  it("scores advancement, matchup hit and orientation-normalized scoreline", () => {
    const files = [
      // Model predicted the pairing FLIPPED vs reality: sim B vs A, reality A vs B.
      simFile("r32", [{ match: 73, home: "B", away: "A" }], [
        { match: 73, home_goals: 0, away_goals: 2 }, // i.e. A wins 2-0 in model's world
      ]),
    ];
    const fixtures = [realFixture(73, "r32", "A", "B")];
    const results = new Map<number, MatchResult>([
      [73, { match: 73, status: "final", home_goals: 2, away_goals: 0, advances: "A" }],
    ]);
    const score = scoreBracket(files, fixtures, results);
    // Advancement: A and B both reach r32 in model's world -> 2 × 1.
    expect(score.advancement).toBe(2);
    expect(score.r32Correct).toBe(2);
    // Matchup hit +1; oriented prediction = A 2-0 B = exact (3) + advancer A correct (+1).
    expect(score.matchupHits).toBe(1);
    expect(score.matchupPoints).toBe(4);
    expect(score.total).toBe(2 + 1 + 4);
  });

  it("awards matchup bonus even before the real match has a result", () => {
    const files = [simFile("sf", [{ match: 101, home: "A", away: "C" }], [
      { match: 101, home_goals: 1, away_goals: 0 },
    ])];
    const fixtures = [realFixture(101, "sf", "A", "C")];
    const score = scoreBracket(files, fixtures, new Map());
    expect(score.matchupHits).toBe(1);
    expect(score.matchupPoints).toBe(0);
  });

  it("no points when pairings differ", () => {
    const files = [simFile("r32", [{ match: 73, home: "A", away: "C" }], [
      { match: 73, home_goals: 1, away_goals: 0 },
    ])];
    const fixtures = [realFixture(73, "r32", "A", "B")];
    const results = new Map<number, MatchResult>([
      [73, { match: 73, status: "final", home_goals: 2, away_goals: 0, advances: "A" }],
    ]);
    const score = scoreBracket(files, fixtures, results);
    expect(score.matchupHits).toBe(0);
    expect(score.matchupPoints).toBe(0);
    // A reaches r32 in both worlds; B does not appear in model's world.
    expect(score.advancement).toBe(1);
  });

  it("champion weight lands when both worlds agree", () => {
    const files = [
      simFile("final", [{ match: 104, home: "A", away: "B" }], [
        { match: 104, home_goals: 3, away_goals: 1 },
      ]),
    ];
    const fixtures = [realFixture(104, "final", "A", "B")];
    const results = new Map<number, MatchResult>([
      [104, { match: 104, status: "final", home_goals: 1, away_goals: 0, advances: "A" }],
    ]);
    const score = scoreBracket(files, fixtures, results);
    expect(score.championCorrect).toBe(true);
    // final reach: A+B (8+8) + champion 13 = 29 advancement; matchup +1;
    // scoreline 3-1 vs 1-0: GD wrong, outcome correct (1) + advancer (+1) = 2.
    expect(score.advancement).toBe(29);
    expect(score.matchupPoints).toBe(2);
    expect(score.total).toBe(29 + 1 + 2);
  });
});
