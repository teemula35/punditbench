import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formByTeam,
  leagueTable,
  loadPreseasonContext,
  loadPreviousSeason,
} from "../lib/league-context";
import { mdKey } from "../lib/types";
import type { Fixture, MatchResult } from "../lib/types";

function fx(match: number, round: number, home: string, away: string, kickoff: string): Fixture {
  return { match, stage: mdKey(round), round, home, away, kickoff_utc: kickoff, city: "" };
}

function final(match: number, hg: number, ag: number): MatchResult {
  return { match, status: "final", home_goals: hg, away_goals: ag };
}

describe("leagueTable", () => {
  const fixtures = [
    fx(1, 1, "Arsenal", "Blackburn", "2026-08-21T19:00:00Z"),
    fx(2, 1, "Chelsea", "Derby", "2026-08-22T14:00:00Z"),
    fx(3, 2, "Blackburn", "Chelsea", "2026-08-28T19:00:00Z"),
    fx(4, 2, "Derby", "Arsenal", "2026-08-29T14:00:00Z"),
    fx(5, 3, "Arsenal", "Chelsea", "2026-09-04T19:00:00Z"),
    fx(6, 3, "Blackburn", "Derby", "2026-09-05T14:00:00Z"),
    fx(7, 4, "Everton", "Arsenal", "2026-09-11T19:00:00Z"),
  ];
  const results: MatchResult[] = [
    final(1, 3, 1), // Arsenal 3-1 Blackburn
    final(2, 2, 0), // Chelsea 2-0 Derby
    final(3, 1, 1), // Blackburn 1-1 Chelsea
    { match: 4, status: "voided", home_goals: 5, away_goals: 0 }, // voided — ignored
    { match: 5, status: "final" }, // final without a score — ignored
    final(99, 9, 9), // no such fixture — ignored
  ];
  const table = leagueTable(fixtures, results);

  it("aggregates only final scored results, joined to fixtures by match number", () => {
    expect(table.find((r) => r.team === "Arsenal")).toEqual({
      team: "Arsenal", played: 1, won: 1, drawn: 0, lost: 0, gf: 3, ga: 1, gd: 2, points: 3,
    });
    expect(table.find((r) => r.team === "Chelsea")).toEqual({
      team: "Chelsea", played: 2, won: 1, drawn: 1, lost: 0, gf: 3, ga: 1, gd: 2, points: 4,
    });
    expect(table.find((r) => r.team === "Blackburn")).toEqual({
      team: "Blackburn", played: 2, won: 0, drawn: 1, lost: 1, gf: 2, ga: 4, gd: -2, points: 1,
    });
    // Derby's only counted match is the 0-2 loss — the voided match 4 must not appear.
    expect(table.find((r) => r.team === "Derby")).toEqual({
      team: "Derby", played: 1, won: 0, drawn: 0, lost: 1, gf: 0, ga: 2, gd: -2, points: 0,
    });
  });

  it("includes a zero row for every fixture team that has not played", () => {
    expect(table.find((r) => r.team === "Everton")).toEqual({
      team: "Everton", played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0,
    });
  });

  it("orders the shared scenario by points, then GD (zero row above -2)", () => {
    expect(table.map((r) => r.team)).toEqual(["Chelsea", "Arsenal", "Blackburn", "Everton", "Derby"]);
  });

  it("sorts by points, then goal difference, then goals for", () => {
    const round = [
      fx(1, 1, "Beta", "Yankee", "2026-08-21T12:00:00Z"),
      fx(2, 1, "Alpha", "Zeta", "2026-08-21T14:00:00Z"),
      fx(3, 1, "Charlie", "Xray", "2026-08-21T16:00:00Z"),
    ];
    const scores = [final(1, 3, 1), final(2, 2, 0), final(3, 1, 0)];
    expect(leagueTable(round, scores).map((r) => r.team)).toEqual([
      "Beta", // 3 pts, +2, 3 gf — GF splits the tie with Alpha
      "Alpha", // 3 pts, +2, 2 gf
      "Charlie", // 3 pts, +1
      "Xray", // 0 pts, -1
      "Yankee", // 0 pts, -2, 1 gf — GF splits the tie with Zeta
      "Zeta", // 0 pts, -2, 0 gf
    ]);
  });

  it("breaks complete ties alphabetically", () => {
    const round = [
      fx(1, 1, "Beta", "Zeta", "2026-08-21T12:00:00Z"),
      fx(2, 1, "Alpha", "Yankee", "2026-08-21T14:00:00Z"),
    ];
    const scores = [final(1, 2, 0), final(2, 2, 0)];
    expect(leagueTable(round, scores).map((r) => r.team)).toEqual(["Alpha", "Beta", "Yankee", "Zeta"]);
  });
});

describe("formByTeam", () => {
  const fixtures = [
    fx(1, 1, "Arsenal", "Coventry City", "2026-08-21T19:00:00Z"),
    fx(2, 1, "Chelsea", "Derby", "2026-08-22T14:00:00Z"),
    fx(3, 2, "Chelsea", "Arsenal", "2026-08-28T19:00:00Z"),
    fx(4, 2, "Derby", "Coventry City", "2026-08-29T14:00:00Z"),
    fx(5, 3, "Arsenal", "Derby", "2026-09-04T19:00:00Z"),
    fx(6, 3, "Coventry City", "Chelsea", "2026-09-05T14:00:00Z"), // not played yet
    fx(7, 4, "Fulham", "Grimsby", "2026-09-11T19:00:00Z"), // not played yet
    fx(8, 4, "Hull", "Ipswich", "2026-09-11T21:00:00Z"), // voided
  ];
  const results: MatchResult[] = [
    final(1, 3, 1), // Arsenal 3-1 Coventry City
    final(2, 2, 2), // Chelsea 2-2 Derby
    final(3, 2, 0), // Chelsea 2-0 Arsenal
    final(4, 0, 1), // Derby 0-1 Coventry City
    final(5, 1, 1), // Arsenal 1-1 Derby
    { match: 8, status: "voided", home_goals: 1, away_goals: 0 },
  ];
  const form = formByTeam(fixtures, results);

  it("formats W/L/D, scoreline and venue from each team's perspective", () => {
    expect(form.get("Arsenal")).toEqual([
      "D 1-1 vs Derby (H)",
      "L 0-2 vs Chelsea (A)",
      "W 3-1 vs Coventry City (H)",
    ]);
    // Away entries keep the goals-for-first scoreline: Derby 0-1 Coventry reads "W 1-0 (A)".
    expect(form.get("Coventry City")).toEqual(["W 1-0 vs Derby (A)", "L 1-3 vs Arsenal (A)"]);
    expect(form.get("Derby")).toEqual([
      "D 1-1 vs Arsenal (A)",
      "L 0-1 vs Coventry City (H)",
      "D 2-2 vs Chelsea (A)",
    ]);
  });

  it("orders most recent kickoff first and caps at n (default 5)", () => {
    expect(formByTeam(fixtures, results, 2).get("Arsenal")).toEqual([
      "D 1-1 vs Derby (H)",
      "L 0-2 vs Chelsea (A)",
    ]);
    const long = Array.from({ length: 6 }, (_, i) =>
      fx(i + 1, i + 1, "Alpha", `Opp${i + 1}`, `2026-08-${String(10 + i).padStart(2, "0")}T12:00:00Z`),
    );
    const alpha = formByTeam(long, long.map((f) => final(f.match, 1, 0))).get("Alpha")!;
    expect(alpha).toHaveLength(5);
    expect(alpha[0]).toBe("W 1-0 vs Opp6 (H)");
    expect(alpha[4]).toBe("W 1-0 vs Opp2 (H)"); // the oldest match (Opp1) fell off
  });

  it("maps teams with no finished matches to empty arrays (voided is not finished)", () => {
    expect(form.get("Fulham")).toEqual([]);
    expect(form.get("Grimsby")).toEqual([]);
    expect(form.get("Hull")).toEqual([]);
    expect(form.get("Ipswich")).toEqual([]);
  });
});

describe("loadPreviousSeason", () => {
  it("reads data/competitions/<id>/previous-season.json under cwd; undefined when absent", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "punditbench-prev-"));
    const prevCwd = process.cwd();
    try {
      const compDir = path.join(dir, "data", "competitions", "test-league");
      fs.mkdirSync(compDir, { recursive: true });
      const stored = {
        season: "2025-26",
        table: ["Liverpool", "Arsenal", "Manchester City"],
        promoted: ["Leeds United", "Burnley", "Sunderland"],
        note: "Sunderland won the playoff final.",
      };
      fs.writeFileSync(path.join(compDir, "previous-season.json"), JSON.stringify(stored), "utf-8");
      process.chdir(dir);
      expect(loadPreviousSeason("test-league")).toEqual(stored);
      expect(loadPreviousSeason("other-league")).toBeUndefined();
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("loadPreseasonContext", () => {
  it("reads data/competitions/<id>/preseason-context.json under cwd; undefined when absent", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "punditbench-ctx-"));
    const prevCwd = process.cwd();
    try {
      const compDir = path.join(dir, "data", "competitions", "test-league");
      fs.mkdirSync(compDir, { recursive: true });
      const stored = {
        as_of: "2026-08-14",
        transfers: ["Arsenal signed Alpha from Beta FC."],
        injuries: ["Everton: Omega out until October (knee)."],
        source: "Compiled from the club sites on 2026-08-14.",
      };
      fs.writeFileSync(path.join(compDir, "preseason-context.json"), JSON.stringify(stored), "utf-8");
      process.chdir(dir);
      expect(loadPreseasonContext("test-league")).toEqual(stored);
      expect(loadPreseasonContext("other-league")).toBeUndefined();
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
