import { describe, expect, it } from "vitest";
import { loadLeagueRoster, loadModelProfiles, loadRoster } from "../lib/data";
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

function model(id: string, label: string, overrides: Partial<RosterModel> = {}): RosterModel {
  return { id, label, vendor: "test", tier: "mid", ...overrides };
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
      points: 5, exact: 1, gd: 1, outcome: 0, scoredMatches: 3,
    });
  });

  it("counts every finished match in an eligible locked round, including a missing round file", () => {
    expect(bySlug.get("test-alpha")!.pointsPerMatch).toBe(2); // 6 / 3
    expect(bySlug.get("test-beta")!.pointsPerMatch).toBeCloseTo(5 / 3); // missing MD2 = 0 / 1
    expect(bySlug.get("test-gamma")!.pointsPerMatch).toBe(0);
    expect(bySlug.get("test-gamma")!.totals.scoredMatches).toBe(3);
  });

  it("counts picksCount as stored prediction entries; a file's missing match still scores 0", () => {
    expect(bySlug.get("test-alpha")!.picksCount).toBe(4);
    expect(bySlug.get("test-beta")!.picksCount).toBe(2);
    const delta = bySlug.get("test-delta")!;
    expect(delta.picksCount).toBe(1);
    // Delta is eligible for both locked rounds, so its omitted MD1 pick and
    // missing MD2 file both score 0 once those fixtures finish.
    expect(delta.totals).toMatchObject({ points: 0, scoredMatches: 3 });
  });

  it("ranks zero-pick eligible models below valid participants, sharing a rank when tied", () => {
    expect(data.leaderboard.map((e) => e.slug)).toEqual([
      "test-alpha", "test-beta", "test-delta", "test-gamma", "test-omega",
    ]);
    expect(data.leaderboard.map((e) => e.rank)).toEqual([1, 2, 3, 3, 3]);
    expect(bySlug.get("test-gamma")!.picksCount).toBe(0);
    expect(bySlug.get("test-omega")!.picksCount).toBe(0);
  });
});

describe("assembleLeagueData — competition-specific join rounds", () => {
  const joinedRoster = [
    model("test/early", "Early"),
    model("test/late", "Late", { league_joined_round: { "test-league": "md02" } }),
  ];
  const joinedFixtures = [
    fx(1, 1, "A", "B", "2026-08-21T19:00:00Z"),
    fx(2, 2, "C", "D", "2026-08-28T19:00:00Z"),
  ];
  const joinedResults = [final(1, 2, 1), final(2, 1, 0)];
  const joinedPredictions = new Map([
    [
      "test-early",
      [pfile("test/early", 1, [[1, 1, 0]]), pfile("test/early", 2, [[2, 0, 2]])],
    ],
    [
      "test-late",
      [
        pfile("test/late", 1, [[1, 2, 1]]), // stray pre-join file must never count
        pfile("test/late", 2, [[2, 1, 0]]),
      ],
    ],
  ]);
  const joinedData = assembleLeagueData(
    comp,
    joinedRoster,
    joinedFixtures,
    joinedResults,
    manifest([1, 2]),
    joinedPredictions,
  );

  it("ignores pre-join files and scores the entrant only from its join round", () => {
    const late = joinedData.leaderboard.find((entry) => entry.slug === "test-late")!;
    expect(late.joinedRound).toBe("md02");
    expect(late.picksCount).toBe(1);
    expect(late.totals).toMatchObject({ points: 3, scoredMatches: 1 });
    expect(late.pointsPerMatch).toBe(3);
  });

  it("ranks by points per scored match before cumulative points", () => {
    expect(joinedData.leaderboard.map((entry) => entry.slug)).toEqual(["test-late", "test-early"]);
    expect(joinedData.leaderboard.map((entry) => entry.rank)).toEqual([1, 2]);
  });

  it("excludes the entrant from pre-join match rows but includes it after joining", () => {
    expect(leagueMatchInfo(joinedData, joinedFixtures[0]).rows.map((row) => row.slug)).toEqual([
      "test-early",
    ]);
    expect(leagueMatchInfo(joinedData, joinedFixtures[1]).rows.map((row) => row.slug)).toEqual([
      "test-late",
      "test-early",
    ]);
  });

  it("leaves a not-yet-started entrant unranked rather than assigning a zero", () => {
    const beforeJoin = assembleLeagueData(
      comp,
      joinedRoster,
      [joinedFixtures[0]],
      [joinedResults[0]],
      manifest([1]),
      new Map([["test-early", [pfile("test/early", 1, [[1, 1, 0]])]]]),
    );
    const late = beforeJoin.leaderboard.find((entry) => entry.slug === "test-late")!;
    expect(late.totals.scoredMatches).toBe(0);
    expect(late.rank).toBeNull();
  });
});

describe("assembleLeagueData — ranking regressions", () => {
  it("breaks equal points-per-match rates by cumulative points", () => {
    const cumulative = model("test/cumulative", "Zulu", {
      league_joined_round: { "test-league": "md01" },
    });
    const oneRound = model("test/one-round", "Alpha", {
      league_joined_round: { "test-league": "md02" },
    });
    const rankingFixtures = [
      fx(1, 1, "A", "B", "2026-08-21T19:00:00Z"),
      fx(2, 2, "C", "D", "2026-08-28T19:00:00Z"),
    ];
    const rankingData = assembleLeagueData(
      comp,
      [oneRound, cumulative],
      rankingFixtures,
      [final(1, 2, 0), final(2, 2, 0)],
      manifest([1, 2]),
      new Map([
        ["test-cumulative", [pfile(cumulative.id, 1, [[1, 1, 0]]), pfile(cumulative.id, 2, [[2, 1, 0]])]],
        ["test-one-round", [pfile(oneRound.id, 2, [[2, 1, 0]])]],
      ]),
    );

    expect(rankingData.leaderboard.map((entry) => entry.pointsPerMatch)).toEqual([1, 1]);
    expect(rankingData.leaderboard.map((entry) => entry.totals.points)).toEqual([2, 1]);
    expect(rankingData.leaderboard.map((entry) => entry.slug)).toEqual([
      "test-cumulative",
      "test-one-round",
    ]);
    expect(rankingData.leaderboard.map((entry) => entry.rank)).toEqual([1, 2]);
  });

  it("gives fully tied entries a shared rank", () => {
    const tiedRoster = [
      model("test/beta", "Beta"),
      model("test/alpha", "Alpha"),
      model("test/gamma", "Gamma"),
    ];
    const rankingFixture = fx(1, 1, "A", "B", "2026-08-21T19:00:00Z");
    const rankingData = assembleLeagueData(
      comp,
      tiedRoster,
      [rankingFixture],
      [final(1, 2, 0)],
      manifest([1]),
      new Map([
        ["test-alpha", [pfile("test/alpha", 1, [[1, 1, 0]])]],
        ["test-beta", [pfile("test/beta", 1, [[1, 1, 0]])]],
        ["test-gamma", [pfile("test/gamma", 1, [[1, 0, 1]])]],
      ]),
    );

    expect(rankingData.leaderboard.map((entry) => entry.slug)).toEqual([
      "test-alpha",
      "test-beta",
      "test-gamma",
    ]);
    expect(rankingData.leaderboard.map((entry) => entry.rank)).toEqual([1, 1, 3]);
  });

  it("sorts ranked entries before a null-ranked entrant", () => {
    const winner = model("test/winner", "Zulu");
    const runnerUp = model("test/runner-up", "Middle");
    const notStarted = model("test/not-started", "Alpha", {
      league_joined_round: { "test-league": "md02" },
    });
    const rankingFixture = fx(1, 1, "A", "B", "2026-08-21T19:00:00Z");
    const rankingData = assembleLeagueData(
      comp,
      [notStarted, runnerUp, winner],
      [rankingFixture],
      [final(1, 2, 0)],
      manifest([1]),
      new Map([
        ["test-winner", [pfile(winner.id, 1, [[1, 2, 0]])]],
        ["test-runner-up", [pfile(runnerUp.id, 1, [[1, 1, 0]])]],
      ]),
    );

    expect(rankingData.leaderboard.map((entry) => entry.slug)).toEqual([
      "test-winner",
      "test-runner-up",
      "test-not-started",
    ]);
    expect(rankingData.leaderboard.map((entry) => entry.rank)).toEqual([1, 2, null]);
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

describe("assembleLeagueData — post-lock scoring exclusions", () => {
  const reversedFixture = fx(2, 1, "Current Home", "Current Away", "2026-08-22T14:00:00Z");
  const exclusion = {
    match: 2,
    espn_id: "401876487",
    classification: "post_lock_home_away_reversal" as const,
    locked_fixture: {
      home: "Locked Home",
      away: "Locked Away",
      city: "Locked City",
      stadium: "Locked Stadium",
    },
    reason: "Fixture home/away was reversed after the lock input was frozen.",
    decided_at: "2026-08-21T07:28:36.959Z",
  };
  const reversedData = assembleLeagueData(
    comp,
    [model("test/alpha", "Alpha")],
    [reversedFixture],
    [final(2, 3, 0)],
    manifest([1]),
    new Map([["test-alpha", [pfile("test/alpha", 1, [[2, 2, 0]])]]]),
    [exclusion],
  );

  it("keeps the real result in the league table but removes it from model scoring", () => {
    expect(reversedData.playedCount).toBe(1);
    expect(reversedData.table.find((row) => row.team === "Current Home")?.points).toBe(3);
    expect(reversedData.leaderboard[0].totals).toMatchObject({ points: 0, scoredMatches: 0 });
  });

  it("keeps the locked pick visible without scoring or reinterpreting it", () => {
    const info = leagueMatchInfo(reversedData, reversedFixture);
    expect(info.state).toBe("post-lock-excluded");
    expect(info.scoringExclusion).toEqual(exclusion);
    expect(info.rows).toHaveLength(1);
    expect(info.rows[0].prediction).toMatchObject({ match: 2, home_goals: 2, away_goals: 0 });
    expect(info.rows[0].score).toBeUndefined();
    expect(info.consensus).toBeUndefined();
    expect(info.split).toBeUndefined();
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

describe("league roster retirement policy", () => {
  it("excludes retired Jamba from every league leaderboard while preserving the World Cup archive", () => {
    expect(loadLeagueRoster().map((model) => model.id)).not.toContain("ai21/jamba-large-1.7");
    expect(loadRoster().map((model) => model.id)).toContain("ai21/jamba-large-1.7");
  });
});

describe("loadLeagueData (disk wiring)", () => {
  it("assembles the EPL competition from data/competitions/", () => {
    const epl = loadLeagueData("epl-2026-27");
    expect(epl.comp.short_name).toBe("Premier League");
    expect(epl.totalFixtures).toBe(380);
    expect(epl.leaderboard).toHaveLength(loadLeagueRoster().length);
    expect(epl.table).toHaveLength(20);
  });
});

describe("loadModelProfiles", () => {
  it("includes every league-roster model, including models absent from the World Cup archive", () => {
    const profileSlugs = new Set(loadModelProfiles().map((m) => modelSlug(m.id)));

    for (const leagueModel of loadLeagueRoster()) {
      expect(profileSlugs).toContain(modelSlug(leagueModel.id));
    }
  });

  it("adds Qwen3.8 Max only to the evolving league roster", () => {
    const qwen = loadLeagueRoster().find((model) => model.id === "qwen/qwen3.8-max");
    expect(qwen).toMatchObject({
      label: "Qwen3.8 Max",
      vendor: "Alibaba",
      tier: "flagship",
      context_length: 1_000_000,
      pricing_prompt_usd_per_m: 2,
      pricing_completion_usd_per_m: 6,
      reasoning: true,
      league_joined_round: { "laliga-2026-27": "md02" },
    });
    expect(loadRoster().map((model) => model.id)).not.toContain("qwen/qwen3.8-max");
  });
});
