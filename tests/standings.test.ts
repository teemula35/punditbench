import { describe, expect, it } from "vitest";
import { groupTable, thirdPlaceRanking } from "../lib/standings";
import type { Fixture, MatchResult, Team } from "../lib/types";

const teams: Team[] = [
  { name: "Alpha", code: "ALP", iso2: "AL", group: "A" },
  { name: "Beta", code: "BET", iso2: "BE", group: "A" },
  { name: "Gamma", code: "GAM", iso2: "GA", group: "A" },
  { name: "Delta", code: "DEL", iso2: "DE", group: "A" },
];

const f = (match: number, home: string, away: string): Fixture => ({
  match, stage: "group", group: "A", home, away, kickoff_utc: "2026-06-12T00:00:00Z", city: "X",
});
const r = (match: number, h: number, a: number): [number, MatchResult] => [
  match, { match, status: "final", home_goals: h, away_goals: a },
];

const fixtures = [
  f(1, "Alpha", "Beta"), f(2, "Gamma", "Delta"),
  f(3, "Alpha", "Gamma"), f(4, "Beta", "Delta"),
  f(5, "Alpha", "Delta"), f(6, "Beta", "Gamma"),
];

describe("groupTable", () => {
  it("computes points/GD and sorts by points, GD, goals", () => {
    const results = new Map([
      r(1, 2, 0), // Alpha beats Beta
      r(2, 1, 1), // Gamma Delta draw
      r(3, 1, 0), // Alpha beats Gamma
      r(4, 0, 3), // Delta beats Beta
      r(5, 2, 2), // Alpha Delta draw
      r(6, 0, 1), // Gamma beats Beta
    ]);
    const table = groupTable("A", teams, fixtures, results);
    expect(table.map((t) => t.team)).toEqual(["Alpha", "Delta", "Gamma", "Beta"]);
    expect(table[0]).toMatchObject({ points: 7, gd: 3, played: 3 });
    expect(table[1]).toMatchObject({ points: 5, gd: 3 });
  });

  it("uses head-to-head before alphabet when points/GD/goals fully tied", () => {
    // Alpha and Beta end fully tied (6 pts, +1, gf 2); Beta won the head-to-head.
    const results = new Map([
      r(1, 0, 1), // Alpha 0-1 Beta  (h2h to Beta)
      r(2, 0, 0), // Gamma 0-0 Delta
      r(3, 1, 0), // Alpha beats Gamma
      r(4, 1, 0), // Beta beats Delta
      r(5, 1, 0), // Alpha beats Delta
      r(6, 0, 1), // Beta 0-1 Gamma
    ]);
    const table = groupTable("A", teams, fixtures, results);
    expect(table.map((t) => t.team)).toEqual(["Beta", "Alpha", "Gamma", "Delta"]);
    expect(table[0].points).toBe(6);
    expect(table[1].points).toBe(6);
  });

  it("an explicit override wins entirely", () => {
    const results = new Map([r(1, 2, 0), r(2, 1, 1), r(3, 1, 0), r(4, 0, 3), r(5, 2, 2), r(6, 0, 1)]);
    const table = groupTable("A", teams, fixtures, results, ["Beta", "Gamma", "Delta", "Alpha"]);
    expect(table.map((t) => t.team)).toEqual(["Beta", "Gamma", "Delta", "Alpha"]);
  });

  it("partial results produce a partial table without crashing", () => {
    const table = groupTable("A", teams, fixtures, new Map([r(1, 1, 0)]));
    expect(table[0].team).toBe("Alpha");
    expect(table.reduce((s, t) => s + t.played, 0)).toBe(2);
  });
});

describe("thirdPlaceRanking", () => {
  it("ranks third-placed teams across groups by points/GD/goals", () => {
    const mk = (team: string, points: number, gd: number, gf: number) =>
      [{ team: "x1", points: 9, gd: 9, gf: 9, ga: 0, won: 3, drawn: 0, lost: 0, played: 3 },
       { team: "x2", points: 6, gd: 3, gf: 5, ga: 2, won: 2, drawn: 0, lost: 1, played: 3 },
       { team, points, gd, gf, ga: 0, won: 1, drawn: 0, lost: 2, played: 3 },
       { team: "x4", points: 0, gd: -9, gf: 0, ga: 9, won: 0, drawn: 0, lost: 3, played: 3 }];
    const tables = new Map([
      ["A", mk("ThirdA", 4, 0, 3)],
      ["B", mk("ThirdB", 4, 1, 2)],
      ["C", mk("ThirdC", 3, 2, 8)],
    ]);
    const ranking = thirdPlaceRanking(tables);
    expect(ranking.map((t) => t.team)).toEqual(["ThirdB", "ThirdA", "ThirdC"]);
  });
});
