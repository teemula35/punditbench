import { describe, expect, it } from "vitest";
import { extractJson, validatePredictions } from "../lib/validate";
import type { Fixture } from "../lib/types";

const fixtures: Fixture[] = [
  { match: 1, stage: "group", group: "A", home: "Mexico", away: "South Africa", kickoff_utc: "2026-06-12T02:00:00Z", city: "Mexico City" },
  { match: 2, stage: "group", group: "A", home: "Canada", away: "Italy", kickoff_utc: "2026-06-12T20:00:00Z", city: "Toronto" },
];
const koFixtures: Fixture[] = [
  { match: 74, stage: "r32", home: "Spain", away: "Poland", kickoff_utc: "2026-06-29T20:00:00Z", city: "Boston" },
];

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("parses fenced JSON", () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("parses JSON embedded in prose", () => {
    expect(extractJson('Sure! {"a":1} Hope that helps.')).toEqual({ a: 1 });
  });
});

describe("validatePredictions — group", () => {
  it("accepts a complete valid set", () => {
    const raw = JSON.stringify({ predictions: [
      { match: 1, home_goals: 2, away_goals: 0 },
      { match: 2, home_goals: 1, away_goals: 1 },
    ]});
    const v = validatePredictions(raw, fixtures);
    expect(v.ok).toBe(true);
    expect(v.predictions).toHaveLength(2);
  });
  it("rejects missing matches, duplicates and bad goals", () => {
    const raw = JSON.stringify({ predictions: [
      { match: 1, home_goals: 2, away_goals: 0 },
      { match: 1, home_goals: 2, away_goals: 0 },
      { match: 2, home_goals: 2.5, away_goals: -1 },
    ]});
    const v = validatePredictions(raw, fixtures);
    expect(v.ok).toBe(false);
    expect(v.errors.join("\n")).toMatch(/more than once/);
    expect(v.errors.join("\n")).toMatch(/integers 0-15/);
    expect(v.errors.join("\n")).toMatch(/Match 2 .* missing/);
  });

  it("tolerates extra entries for unlisted match numbers (dropped with a warning)", () => {
    // Some models keep predicting into the knockout bracket past the listed fixtures.
    const raw = JSON.stringify({ predictions: [
      { match: 1, home_goals: 2, away_goals: 0 },
      { match: 2, home_goals: 1, away_goals: 1 },
      { match: 73, home_goals: 2, away_goals: 1 },
      { match: 104, home_goals: 1, away_goals: 0 },
    ]});
    const v = validatePredictions(raw, fixtures);
    expect(v.ok).toBe(true);
    expect(v.predictions).toHaveLength(2);
    expect(v.warnings.join("\n")).toMatch(/unlisted match number 73/);
    expect(v.warnings.join("\n")).toMatch(/unlisted match number 104/);
  });
});

describe("validatePredictions — knockout", () => {
  it("requires advances on a predicted draw", () => {
    const v = validatePredictions(JSON.stringify({ predictions: [{ match: 74, home_goals: 1, away_goals: 1 }] }), koFixtures);
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toMatch(/"advances" is required/);
  });
  it("rejects advances contradicting a decisive score", () => {
    const v = validatePredictions(JSON.stringify({ predictions: [{ match: 74, home_goals: 2, away_goals: 1, advances: "Poland" }] }), koFixtures);
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toMatch(/contradicts/);
  });
  it("rejects advances naming a non-participant", () => {
    const v = validatePredictions(JSON.stringify({ predictions: [{ match: 74, home_goals: 1, away_goals: 1, advances: "France" }] }), koFixtures);
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toMatch(/must be exactly/);
  });
  it("accepts a valid knockout prediction", () => {
    const v = validatePredictions(JSON.stringify({ predictions: [{ match: 74, home_goals: 1, away_goals: 1, advances: "Spain" }] }), koFixtures);
    expect(v.ok).toBe(true);
    expect(v.predictions[0].advances).toBe("Spain");
  });
});
