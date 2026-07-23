import { describe, expect, it } from "vitest";
import { loadSiteData, type LeaderboardEntry, type SiteData } from "../lib/aggregate";
import { costPhrase, reportCardFor, reportCards, standingPhrase, teamFate } from "../lib/report-card";
import type { Fixture, MatchResult, PredictionFile, RosterModel, StageId } from "../lib/types";

const fx = (match: number, stage: StageId, home: string, away: string): Fixture => ({
  match, stage, home, away, kickoff_utc: "2026-07-01T00:00:00Z", city: "X",
});

const won = (match: number, home_goals: number, away_goals: number, advances?: string): MatchResult => ({
  match, status: "final", home_goals, away_goals, ...(advances ? { advances } : {}),
});

const byMatch = (fixtures: Fixture[]) => new Map(fixtures.map((f) => [f.match, f]));
const keyed = (results: MatchResult[]) => new Map(results.map((r) => [r.match, r]));

// A full real bracket in miniature: A beats B in the r32, C goes out in the
// r16, D in the qf, E loses the semi and then the third-place match, A beats F
// in the final. G plays a group match and never appears again.
const REAL_FIXTURES = [
  fx(1, "group", "A", "G"),
  fx(73, "r32", "A", "B"),
  fx(89, "r16", "A", "C"),
  fx(97, "qf", "A", "D"),
  fx(101, "sf", "A", "E"),
  fx(103, "third", "E", "H"),
  fx(104, "final", "A", "F"),
];
const REAL_RESULTS = [
  won(1, 1, 0),
  won(73, 2, 0, "A"),
  won(89, 1, 0, "A"),
  won(97, 3, 1, "A"),
  won(101, 2, 1, "A"),
  won(103, 0, 1, "H"),
  won(104, 1, 0, "A"),
];

describe("teamFate", () => {
  const fixtures = byMatch(REAL_FIXTURES);
  const results = keyed(REAL_RESULTS);
  const fate = (team: string) => teamFate(team, fixtures, results);

  it("names the winner and the beaten finalist", () => {
    expect(fate("A")).toBe("won it");
    expect(fate("F")).toBe("lost the final");
  });

  it("places the third-place match on the podium, not in the semi-finals", () => {
    expect(fate("H")).toBe("finished third");
    expect(fate("E")).toBe("finished fourth");
  });

  it("names the round a team went out in", () => {
    expect(fate("B")).toBe("out in the round of 32");
    expect(fate("C")).toBe("out in the round of 16");
    expect(fate("D")).toBe("out in the quarter-finals");
  });

  it("calls a team with no knockout fixture a group-stage exit", () => {
    expect(fate("G")).toBe("out in the group stage");
  });

  it("says nothing about a team that isn't in the tournament", () => {
    expect(fate("Atlantis")).toBeUndefined();
  });

  it("says nothing before the knockout draw exists", () => {
    expect(teamFate("A", byMatch([fx(1, "group", "A", "G")]), keyed([won(1, 1, 0)]))).toBeUndefined();
  });

  it("says nothing while a team is still in it", () => {
    // Won its r32 tie; the r16 fixture it feeds has no result yet.
    const results = keyed([won(73, 2, 0, "A"), won(1, 1, 0)]);
    expect(teamFate("A", fixtures, results)).toBeUndefined();
    // Its beaten opponent's fate is settled all the same.
    expect(teamFate("B", fixtures, results)).toBe("out in the round of 32");
  });

  it("says nothing when a played knockout match records no advancer", () => {
    expect(teamFate("B", fixtures, keyed([won(73, 2, 0)]))).toBeUndefined();
  });
});

describe("costPhrase", () => {
  it("uses dollars from a dime up", () => {
    expect(costPhrase(16.2978)).toBe("$16.30");
    expect(costPhrase(0.40396)).toBe("$0.40");
    expect(costPhrase(0.1)).toBe("$0.10");
  });

  it("uses whole cents below a dime", () => {
    expect(costPhrase(0.084)).toBe("8 cents");
    expect(costPhrase(0.0232)).toBe("2 cents");
  });

  it("uses fractions below a cent and a half", () => {
    expect(costPhrase(0.0105)).toBe("a cent");
    expect(costPhrase(0.00475)).toBe("half a cent");
    expect(costPhrase(0.0029)).toBe("a third of a cent");
    expect(costPhrase(0.0000001)).toBe("a fraction of a cent");
  });

  it("handles a missing or zero spend", () => {
    expect(costPhrase(0)).toBe("nothing");
    expect(costPhrase(Number.NaN)).toBe("nothing");
  });
});

describe("standingPhrase", () => {
  it("singles out the winner and the podium", () => {
    expect(standingPhrase(1, 40)).toBe("top of the table");
    expect(standingPhrase(3, 40)).toBe("top 3");
  });

  it("bands the rest of the field into thirds", () => {
    expect(standingPhrase(4, 40)).toBe("the top third");
    expect(standingPhrase(13, 40)).toBe("the top third");
    expect(standingPhrase(14, 40)).toBe("mid-table");
    expect(standingPhrase(26, 40)).toBe("mid-table");
    expect(standingPhrase(27, 40)).toBe("bottom of the table");
    expect(standingPhrase(40, 40)).toBe("bottom of the table");
  });
});

/** A stored prediction file, with the recorded spend that makes it into costUsd. */
function file(
  slug: string,
  stage: StageId,
  predictions: PredictionFile["predictions"],
  costUsd?: number,
): PredictionFile {
  return {
    model: slug, slug, stage, prompt_version: "v1", params: {},
    requested_at: "", completed_at: "", attempts: 1,
    ...(costUsd === undefined ? {} : { usage: { cost_usd: costUsd } }),
    predictions,
  };
}

function entryFor(opts: {
  slug: string;
  rank: number;
  totalPoints?: number;
  championPick?: string;
  championCorrect?: boolean;
  files?: PredictionFile[];
  liveFiles?: PredictionFile[];
}): LeaderboardEntry {
  const model: RosterModel = {
    id: `vendor/${opts.slug}`, label: opts.slug.toUpperCase(), vendor: "Vendor", tier: "small",
  };
  return {
    model,
    slug: opts.slug,
    totals: {
      slug: opts.slug, points: 0, exact: 0, gd: 0, outcome: 0, advances: 0,
      scoredMatches: 0, matchesWithPoints: 0, perStage: {},
    },
    bracket: {
      advancement: 0, matchupHits: 0, matchupPoints: 0, total: 0,
      championCorrect: opts.championCorrect ?? false, r32Correct: 0, perStage: new Map(),
    },
    totalPoints: opts.totalPoints ?? 0,
    exactCount: 0,
    championPick: opts.championPick,
    rank: opts.rank,
    hasPredictions: true,
    bracketComplete: false,
    scores: new Map(),
    files: opts.files ?? [],
    liveFiles: opts.liveFiles ?? [],
  };
}

function siteDataFor(leaderboard: LeaderboardEntry[], excluded: number[] = []): SiteData {
  return {
    roster: leaderboard.map((e) => e.model),
    fixtures: byMatch(REAL_FIXTURES),
    results: keyed(REAL_RESULTS),
    leaderboard,
    personalities: new Map(),
    playedCount: REAL_RESULTS.length,
    totalFixtures: 104,
    liveExcluded: new Map(excluded.map((m) => [m, "kicked off first"])),
    liveRounds: {},
  };
}

describe("reportCards", () => {
  // Two live picks on the real bracket: both exact, both with the right
  // advancer, so each is worth 3 + 1 = 4 points.
  const livePicks = [
    file("winner", "r32", [{ match: 73, home_goals: 2, away_goals: 0 }], 0.25),
    file("winner", "r16", [{ match: 89, home_goals: 1, away_goals: 0 }], 0.25),
  ];
  const leaderboard = [
    entryFor({
      slug: "winner", rank: 1, totalPoints: 200, championPick: "A", championCorrect: true,
      files: [file("winner", "group", [{ match: 1, home_goals: 1, away_goals: 0 }], 0.5)],
      liveFiles: livePicks,
    }),
    entryFor({
      slug: "loser", rank: 2, totalPoints: 100, championPick: "C",
      files: [file("loser", "group", [{ match: 1, home_goals: 0, away_goals: 1 }], 0.002)],
    }),
  ];

  it("scores the round-by-round picks and ranks them among the live field", () => {
    const cards = reportCards(siteDataFor(leaderboard));
    expect(cards.get("winner")).toMatchObject({ livePoints: 8, liveRank: 1 });
  });

  it("never scores an excluded match", () => {
    const cards = reportCards(siteDataFor(leaderboard, [73]));
    expect(cards.get("winner")!.livePoints).toBe(4);
  });

  it("leaves the live fields undefined for a model with no live picks", () => {
    const card = reportCards(siteDataFor(leaderboard)).get("loser")!;
    expect(card.livePoints).toBeUndefined();
    expect(card.liveRank).toBeUndefined();
  });

  it("sums spend across both prediction trees", () => {
    const cards = reportCards(siteDataFor(leaderboard));
    expect(cards.get("winner")!.costUsd).toBeCloseTo(1.0, 10); // 0.5 locked + 2 × 0.25 live
    expect(cards.get("loser")!.costUsd).toBeCloseTo(0.002, 10);
  });

  it("carries the roster identity and the locked standing straight through", () => {
    const card = reportCards(siteDataFor(leaderboard)).get("winner")!;
    expect(card).toMatchObject({
      slug: "winner", label: "WINNER", vendor: "Vendor", tier: "small",
      lockedPoints: 200, lockedRank: 1, exactCount: 0,
    });
  });

  it("reads the champion call and how that team actually finished", () => {
    const cards = reportCards(siteDataFor(leaderboard));
    expect(cards.get("winner")).toMatchObject({
      championPick: "A", championCorrect: true, championFate: "won it",
    });
    expect(cards.get("loser")).toMatchObject({
      championPick: "C", championCorrect: false, championFate: "out in the round of 16",
    });
  });

  it("derives a verdict from spend, standing and the champion call", () => {
    const cards = reportCards(siteDataFor(leaderboard));
    expect(cards.get("winner")!.verdict).toBe("$1.00 and top of the table — it called A.");
    expect(cards.get("loser")!.verdict).toBe(
      "a fifth of a cent and top 3 — it backed C (out in the round of 16).",
    );
  });

  it("says so when a model never named a champion", () => {
    const anonymous = [entryFor({ slug: "blank", rank: 1 })];
    const card = reportCards(siteDataFor(anonymous)).get("blank")!;
    expect(card.championFate).toBeUndefined();
    expect(card.verdict).toBe("nothing and top of the table — it never named a champion.");
  });
});

describe("reportCardFor", () => {
  it("returns the card for a known slug and nothing for an unknown one", () => {
    const data = siteDataFor([entryFor({ slug: "winner", rank: 1 })]);
    expect(reportCardFor(data, "winner")!.slug).toBe("winner");
    expect(reportCardFor(data, "nope")).toBeUndefined();
  });
});

/**
 * The round-by-round totals are the same numbers `npm run audit -- --live`
 * prints — that leaderboard is the source of truth, so pin the top of it here.
 */
describe("report cards over the real tournament", () => {
  const cards = reportCards(loadSiteData());

  it("matches the live audit leaderboard", () => {
    expect(cards.get("z-ai-glm-4-7-flash")).toMatchObject({ livePoints: 67, liveRank: 1 });
    expect(cards.get("z-ai-glm-5-1")).toMatchObject({ livePoints: 61, liveRank: 2 });
    expect(cards.get("mistralai-mistral-small-2603")).toMatchObject({ livePoints: 60, liveRank: 3 });
  });

  it("has no live standing for the one model that never made live picks", () => {
    const card = cards.get("meta-llama-llama-3-70b-instruct")!;
    expect(card.livePoints).toBeUndefined();
    expect(card.liveRank).toBeUndefined();
    expect([...cards.values()].filter((c) => c.livePoints !== undefined)).toHaveLength(39);
  });

  it("marks the models that called Spain, and places every other pick", () => {
    for (const card of cards.values()) {
      expect(card.championCorrect).toBe(card.championPick === "Spain");
      expect(card.championFate).toBe(card.championCorrect ? "won it" : card.championFate);
      expect(card.championFate).toBeDefined();
    }
  });

  it("puts the priciest model four orders of magnitude above the cheapest", () => {
    const costs = [...cards.values()].map((c) => c.costUsd);
    expect(cards.get("openai-gpt-5-5-pro")!.costUsd).toBe(Math.max(...costs));
    expect(cards.get("meta-llama-llama-4-scout")!.costUsd).toBe(Math.min(...costs));
    expect(cards.get("meta-llama-llama-4-scout")!.costUsd).toBeLessThan(0.005);
  });

  it("keeps every verdict short enough to render on a social card", () => {
    for (const card of cards.values()) {
      expect(card.verdict.length, card.slug).toBeLessThanOrEqual(150);
      expect(card.championFate!.length, card.slug).toBeLessThanOrEqual(26);
    }
  });
});
