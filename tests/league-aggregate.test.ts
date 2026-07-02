import { describe, expect, it } from "vitest";
import { loadRoster } from "../lib/data";
import {
  assembleLeagueData,
  fixturesByRound,
  leagueMatchInfo,
  loadLeagueData,
  nextRound,
} from "../lib/league-aggregate";
import { modelSlug } from "../lib/prompt";
import { mdKey } from "../lib/types";
import type {
  Competition,
  Fixture,
  LiveManifest,
  MatchResult,
  PredictionFile,
  RosterModel,
} from "../lib/types";

const comp: Competition = {
  id: "test-league", kind: "league", name: "Test League 2026-27", short_name: "Test League",
  season_label: "2026-27", espn_slug: "tst.1", team_count: 4, round_count: 2, active: true,
};

function model(id: string, label: string): RosterModel {
  return { id, label, vendor: "test", tier: "mid" };
}

// Passed deliberately out of label order — assembly must sort by label.
const roster = [
  model("test/omega", "Omega"),
  model("test/alpha", "Alpha"),
  model("test/gamma", "Gamma"),
  model("test/beta", "Beta"),
  model("test/delta", "Delta"),
];

function fx(match: number, round: number, home: string, away: string, kickoff: string): Fixture {
  return { match, stage: mdKey(round), round, home, away, kickoff_utc: kickoff, city: "" };
}

function final(match: number, hg: number, ag: number): MatchResult {
  return { match, status: "final", home_goals: hg, away_goals: ag };
}

function pfile(modelId: string, round: number, preds: [number, number, number][]): PredictionFile {
  return {
    model: modelId,
    slug: modelSlug(modelId),
    stage: mdKey(round),
    prompt_version: "test",
    params: {},
    requested_at: "2026-08-20T06:00:00Z",
    completed_at: "2026-08-20T06:00:05Z",
    attempts: 1,
    predictions: preds.map(([match, home_goals, away_goals]) => ({ match, home_goals, away_goals })),
  };
}

function manifest(lockedRounds: number[], excluded: Record<string, string> = {}): LiveManifest {
  const out: LiveManifest = { excluded, rounds: {} };
  for (const r of lockedRounds) {
    out.rounds[mdKey(r)] = { locked_at: "2026-08-20T07:00:00Z", models: 5, excluded: [] };
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Shared scenario: two locked rounds, three of four matches played.  */

const fixtures = [
  fx(1, 1, "A", "B", "2026-08-21T19:00:00Z"),
  fx(2, 1, "C", "D", "2026-08-22T14:00:00Z"),
  fx(3, 2, "B", "C", "2026-08-28T19:00:00Z"),
  fx(4, 2, "D", "A", "2026-08-29T14:00:00Z"), // not played yet
];
const results = [final(1, 2, 1), final(2, 0, 0), final(3, 1, 3)];
const predictions = new Map([
  // Alpha: exact (3) + gd via 1-1 on a 0-0 draw (2) + outcome on 1-3 (1); match 4 unplayed.
  ["test-alpha", [pfile("test/alpha", 1, [[1, 2, 1], [2, 1, 1]]), pfile("test/alpha", 2, [[3, 0, 1], [4, 5, 0]])]],
  // Beta: gd on 2-1 via 3-2 (2) + exact 0-0 (3); no MD2 file at all.
  ["test-beta", [pfile("test/beta", 1, [[1, 3, 2], [2, 0, 0]])]],
  // Delta: one wrong pick; its MD1 file omits match 2, which still scores 0.
  ["test-delta", [pfile("test/delta", 1, [[1, 0, 3]])]],
  // Gamma and Omega: no picks stored at all.
]);
const data = assembleLeagueData(comp, roster, fixtures, results, manifest([1, 2]), predictions);
const bySlug = new Map(data.leaderboard.map((e) => [e.slug, e]));

describe("assembleLeagueData — season leaderboard", () => {
  it("aggregates totals across two locked rounds", () => {
    expect(bySlug.get("test-alpha")!.totals).toMatchObject({
      points: 6, exact: 1, gd: 1, outcome: 1, scoredMatches: 3, matchesWithPoints: 3,
    });
    expect(bySlug.get("test-beta")!.totals).toMatchObject({
      points: 5, exact: 1, gd: 1, outcome: 0, scoredMatches: 2,
    });
  });

  it("computes points-per-match over each model's own scored matches (0 when none)", () => {
    expect(bySlug.get("test-alpha")!.pointsPerMatch).toBe(2); // 6 / 3
    expect(bySlug.get("test-beta")!.pointsPerMatch).toBe(2.5); // 5 / 2 — fewer rounds, higher rate
    expect(bySlug.get("test-gamma")!.pointsPerMatch).toBe(0); // 0 / 0 stays 0
  });

  it("counts picksCount as stored prediction entries; a file's missing match still scores 0", () => {
    expect(bySlug.get("test-alpha")!.picksCount).toBe(4);
    expect(bySlug.get("test-beta")!.picksCount).toBe(2);
    const delta = bySlug.get("test-delta")!;
    expect(delta.picksCount).toBe(1);
    // Delta locked an MD1 file, so it is scored on BOTH MD1 matches (missing pick = 0).
    expect(delta.totals).toMatchObject({ points: 0, scoredMatches: 2 });
  });

  it("ranks zero-pick models below every participant, sharing a rank when fully tied", () => {
    expect(data.leaderboard.map((e) => e.slug)).toEqual([
      "test-alpha", "test-beta", "test-delta", "test-gamma", "test-omega",
    ]);
    expect(data.leaderboard.map((e) => e.rank)).toEqual([1, 2, 3, 4, 4]);
    expect(bySlug.get("test-gamma")!.picksCount).toBe(0);
    expect(bySlug.get("test-omega")!.picksCount).toBe(0);
  });
});

describe("assembleLeagueData — excluded matches", () => {
  const exFixtures = [fx(1, 1, "A", "B", "2026-08-21T19:00:00Z"), fx(2, 1, "C", "D", "2026-08-22T14:00:00Z")];
  const exResults = [final(1, 2, 1), final(2, 3, 0)];
  const reason = "Rescheduled at short notice and already kicked off when Matchday 1 picks were locked.";
  const exData = assembleLeagueData(
    comp, roster, exFixtures, exResults,
    manifest([1], { "2": reason }),
    new Map([["test-alpha", [pfile("test/alpha", 1, [[1, 2, 1]])]]]),
  );

  it("drops manifest-excluded matches from scoring entirely", () => {
    // Match 2 finished 3-0 but was excluded — it must not count as a missing-pick 0.
    expect(exData.leaderboard.find((e) => e.slug === "test-alpha")!.totals).toMatchObject({
      points: 3, scoredMatches: 1,
    });
  });

  it("exclusion beats a locked round in leagueMatchInfo", () => {
    const info = leagueMatchInfo(exData, exFixtures[1]);
    expect(info.state).toBe("excluded");
    expect(info.excludedReason).toBe(reason);
    expect(info.rows).toEqual([]);
  });
});

describe("leagueMatchInfo — state machine and rows", () => {
  it("returns picks with lock metadata for a locked round", () => {
    const info = leagueMatchInfo(data, fixtures[0]);
    expect(info.state).toBe("picks");
    expect(info.lockedAt).toBe("2026-08-20T07:00:00Z");
    expect(info.rows).toHaveLength(5);
  });

  it("sorts played rows by scored points then slug, scoring missing picks 0", () => {
    const info = leagueMatchInfo(data, fixtures[0]); // A 2-1 B
    expect(info.rows.map((r) => r.slug)).toEqual([
      "test-alpha", "test-beta", "test-delta", "test-gamma", "test-omega",
    ]);
    expect(info.rows.map((r) => r.score?.points)).toEqual([3, 2, 0, 0, 0]);
    expect(info.rows[0].score?.breakdown).toBe("exact");
    expect(info.rows[1].score?.breakdown).toBe("gd");
    expect(info.rows[2].score?.breakdown).toBe("none"); // wrong pick
    expect(info.rows[3].score?.breakdown).toBe("missing"); // no file at all
  });

  it("sorts pre-kickoff rows by slug and leaves scores unset", () => {
    const info = leagueMatchInfo(data, fixtures[3]); // MD2 locked, match 4 not played
    expect(info.state).toBe("picks");
    expect(info.rows.map((r) => r.slug)).toEqual([
      "test-alpha", "test-beta", "test-delta", "test-gamma", "test-omega",
    ]);
    expect(info.rows.every((r) => r.score === undefined)).toBe(true);
    expect(info.rows[0].prediction).toMatchObject({ match: 4, home_goals: 5, away_goals: 0 });
    expect(info.rows[1].prediction).toBeUndefined();
  });
});

describe("leagueMatchInfo — consensus and split", () => {
  // MD1 locked; MD2 not locked even though a stray MD2 file exists.
  const cFixtures = [
    fx(1, 1, "A", "B", "2026-08-21T19:00:00Z"),
    fx(2, 1, "C", "D", "2026-08-21T12:00:00Z"), // earlier kickoff than match 1
    fx(3, 2, "B", "C", "2026-08-28T19:00:00Z"),
  ];
  const cData = assembleLeagueData(
    comp, roster, cFixtures, [], manifest([1]),
    new Map([
      ["test-alpha", [pfile("test/alpha", 1, [[1, 2, 1], [2, 0, 0]]), pfile("test/alpha", 2, [[3, 1, 0]])]],
      ["test-beta", [pfile("test/beta", 1, [[1, 2, 1], [2, 1, 0]])]],
      ["test-delta", [pfile("test/delta", 1, [[1, 0, 1], [2, 3, 0]])]],
    ]),
  );

  it("returns pending when the round is not locked, even with stray files", () => {
    const info = leagueMatchInfo(cData, cFixtures[2]);
    expect(info.state).toBe("pending");
    expect(info.rows).toEqual([]);
    expect(info.consensus).toBeUndefined();
  });

  it("computes consensus as the most common scoreline plus the 1/X/2 split", () => {
    const info = leagueMatchInfo(cData, cFixtures[0]); // 2-1, 2-1, 0-1
    expect(info.consensus).toEqual({ home: 2, away: 1, count: 2, outOf: 3 });
    expect(info.split).toEqual({ home: 2, draw: 0, away: 1, outOf: 3 });
  });

  it("breaks consensus ties toward the lower-scoring line", () => {
    const info = leagueMatchInfo(cData, cFixtures[1]); // 0-0, 1-0, 3-0 — one each
    expect(info.consensus).toEqual({ home: 0, away: 0, count: 1, outOf: 3 });
    expect(info.split).toEqual({ home: 2, draw: 1, away: 0, outOf: 3 });
  });

  it("groups fixtures by round in kickoff order and finds the next unresulted round", () => {
    const rounds = fixturesByRound(cData);
    expect([...rounds.keys()]).toEqual([1, 2]);
    expect(rounds.get(1)!.map((f) => f.match)).toEqual([2, 1]); // kickoff order, not match order
    expect(nextRound(cData)?.round).toBe(1); // nothing played yet
    expect(nextRound(data)?.round).toBe(2); // MD1 fully resulted, match 4 still open
    const done = assembleLeagueData(
      comp, roster, [fx(1, 1, "A", "B", "2026-08-21T19:00:00Z")], [final(1, 1, 0)],
      manifest([1]), new Map(),
    );
    expect(nextRound(done)).toBeUndefined();
  });
});

describe("loadLeagueData (disk wiring)", () => {
  it("assembles the EPL competition from data/competitions/", () => {
    const epl = loadLeagueData("epl-2026-27");
    expect(epl.comp.short_name).toBe("Premier League");
    expect(epl.totalFixtures).toBe(380);
    expect(epl.leaderboard).toHaveLength(loadRoster().length);
    expect(epl.table).toHaveLength(20);
  });
});
