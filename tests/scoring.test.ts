import { describe, expect, it } from "vitest";
import { compareTotals, rank, scoreMatch, totalsFor, predictedAdvancer } from "../lib/scoring";
import type { Fixture, MatchResult, ModelTotals, Prediction } from "../lib/types";

const groupFixture: Fixture = {
  match: 1, stage: "group", group: "A", home: "Mexico", away: "South Africa",
  kickoff_utc: "2026-06-12T02:00:00Z", city: "Mexico City",
};
const koFixture: Fixture = {
  match: 74, stage: "r32", home: "Spain", away: "Poland",
  kickoff_utc: "2026-06-29T20:00:00Z", city: "Boston",
};

const final = (h: number, a: number, advances?: string): MatchResult => ({
  match: 1, status: "final", home_goals: h, away_goals: a, ...(advances ? { advances } : {}),
});
const p = (h: number, a: number, advances?: string): Prediction => ({
  match: 1, home_goals: h, away_goals: a, ...(advances ? { advances } : {}),
});

describe("scoreMatch — group stage (D1)", () => {
  it("exact score = 3", () => {
    expect(scoreMatch(p(2, 1), final(2, 1), groupFixture)).toMatchObject({ points: 3, breakdown: "exact" });
  });
  it("correct goal difference = 2", () => {
    expect(scoreMatch(p(3, 2), final(2, 1), groupFixture)).toMatchObject({ points: 2, breakdown: "gd" });
  });
  it("a correct draw with wrong scoreline counts as goal difference = 2", () => {
    expect(scoreMatch(p(1, 1), final(2, 2), groupFixture)).toMatchObject({ points: 2, breakdown: "gd" });
  });
  it("correct outcome only = 1", () => {
    expect(scoreMatch(p(1, 0), final(3, 1), groupFixture)).toMatchObject({ points: 1, breakdown: "outcome" });
  });
  it("wrong outcome = 0", () => {
    expect(scoreMatch(p(0, 1), final(2, 0), groupFixture)).toMatchObject({ points: 0, breakdown: "none" });
  });
  it("draw predicted, decisive result = 0", () => {
    expect(scoreMatch(p(1, 1), final(1, 0), groupFixture)).toMatchObject({ points: 0, breakdown: "none" });
  });
  it("missing prediction = 0 but still a scored match", () => {
    expect(scoreMatch(undefined, final(1, 0), groupFixture)).toMatchObject({ points: 0, breakdown: "missing" });
  });
  it("voided match returns null (excluded)", () => {
    expect(scoreMatch(p(1, 0), { match: 1, status: "voided" }, groupFixture)).toBeNull();
  });
  it("no advance bonus in the group stage even if result has advances set", () => {
    expect(scoreMatch(p(2, 1), final(2, 1, "Mexico"), groupFixture)?.advance_bonus).toBe(0);
  });
});

describe("scoreMatch — knockout (D1)", () => {
  const koResult = (h: number, a: number, advances: string): MatchResult => ({
    match: 74, status: "final", home_goals: h, away_goals: a, advances,
  });
  const kp = (h: number, a: number, advances?: string): Prediction => ({
    match: 74, home_goals: h, away_goals: a, ...(advances ? { advances } : {}),
  });

  it("exact 90' score + correct advancer = 4", () => {
    expect(scoreMatch(kp(2, 1), koResult(2, 1, "Spain"), koFixture)).toMatchObject({ points: 4, breakdown: "exact", advance_bonus: 1 });
  });
  it("predicted 90' draw + correct advancer on a draw that went to pens = 3 (gd) + 1", () => {
    expect(scoreMatch(kp(1, 1, "Spain"), koResult(2, 2, "Spain"), koFixture)).toMatchObject({ points: 3, breakdown: "gd", advance_bonus: 1 });
  });
  it("wrong 90' outcome but correct advancer = 1", () => {
    // Actual: 1-1 after 90, Spain advances on pens. Predicted 2-1 Spain.
    expect(scoreMatch(kp(2, 1), koResult(1, 1, "Spain"), koFixture)).toMatchObject({ points: 1, breakdown: "none", advance_bonus: 1 });
  });
  it("correct 90' exact but wrong advancer = 3", () => {
    expect(scoreMatch(kp(1, 1, "Poland"), koResult(1, 1, "Spain"), koFixture)).toMatchObject({ points: 3, breakdown: "exact", advance_bonus: 0 });
  });
  it("implicit advancer from a decisive predicted score", () => {
    expect(predictedAdvancer(kp(2, 0), koFixture)).toBe("Spain");
    // 2-0 vs actual 1-0: outcome correct (1) + advancer correct (+1)
    expect(scoreMatch(kp(2, 0), koResult(1, 0, "Spain"), koFixture)).toMatchObject({ points: 2, breakdown: "outcome", advance_bonus: 1 });
    // 2-1 vs actual 1-0: goal difference correct (2) + advancer correct (+1)
    expect(scoreMatch(kp(2, 1), koResult(1, 0, "Spain"), koFixture)).toMatchObject({ points: 3, breakdown: "gd", advance_bonus: 1 });
  });
  it("predicted draw without explicit advancer never crashes and earns no bonus", () => {
    expect(scoreMatch(kp(1, 1), koResult(1, 1, "Spain"), koFixture)).toMatchObject({ points: 3, advance_bonus: 0 });
  });
});

describe("tiebreakers and ranking (D1)", () => {
  const t = (over: Partial<ModelTotals>): ModelTotals => ({
    slug: "x", points: 0, exact: 0, gd: 0, outcome: 0, advances: 0,
    scoredMatches: 0, matchesWithPoints: 0, perStage: {}, ...over,
  });
  it("points first, then exacts, then matches-with-points, then advances", () => {
    expect(compareTotals(t({ points: 10 }), t({ points: 9, exact: 5 }))).toBeLessThan(0);
    expect(compareTotals(t({ points: 10, exact: 2 }), t({ points: 10, exact: 3 }))).toBeGreaterThan(0);
    expect(compareTotals(t({ points: 10, exact: 2, matchesWithPoints: 6 }), t({ points: 10, exact: 2, matchesWithPoints: 5 }))).toBeLessThan(0);
    expect(compareTotals(t({ points: 10, exact: 2, matchesWithPoints: 6, advances: 1 }), t({ points: 10, exact: 2, matchesWithPoints: 6, advances: 2 }))).toBeGreaterThan(0);
  });
  it("full ties share a rank", () => {
    const ranked = rank([t({ slug: "a", points: 5 }), t({ slug: "b", points: 5 }), t({ slug: "c", points: 3 })]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});

describe("totalsFor aggregation", () => {
  it("aggregates breakdowns and per-stage points", () => {
    const fixtures = new Map<number, Fixture>([
      [1, groupFixture],
      [74, koFixture],
    ]);
    const scores = new Map([
      [1, { match: 1, points: 3, breakdown: "exact" as const, advance_bonus: 0 as const }],
      [74, { match: 74, points: 4, breakdown: "exact" as const, advance_bonus: 1 as const }],
    ]);
    const totals = totalsFor("m", scores, fixtures);
    expect(totals).toMatchObject({
      points: 7, exact: 2, advances: 1, scoredMatches: 2, matchesWithPoints: 2,
    });
    expect(totals.perStage).toEqual({ group: 3, r32: 4 });
  });
});
