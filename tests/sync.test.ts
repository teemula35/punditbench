import { describe, expect, it } from "vitest";
import {
  datesToQuery,
  normalizeTeamName,
  parseScoreboard,
  parseSummaryScore90,
  planSync,
  resolveTeamName,
  type EspnEvent,
} from "../lib/sync";
import type { Fixture, MatchResult, Team } from "../lib/types";

const team = (name: string): Team => ({ name, code: "XXX", iso2: "xx", group: "A" });
const teams: Team[] = [
  "Mexico", "South Africa", "South Korea", "Czech Republic", "Turkey",
  "Bosnia and Herzegovina", "DR Congo", "Curaçao", "Spain", "Poland",
].map(team);

const fx = (match: number, home: string, away: string, kickoff: string, stage: Fixture["stage"] = "group"): Fixture => ({
  match, stage, ...(stage === "group" ? { group: "A" } : {}), home, away, kickoff_utc: kickoff, city: "",
});

const ev = (over: Partial<EspnEvent>): EspnEvent => ({
  id: "1", date: "2026-06-11T19:00Z", home: "Mexico", away: "South Africa",
  home_score: 2, away_score: 0, completed: true, status: "STATUS_FULL_TIME", detail: "FT",
  home_winner: true, away_winner: false,
  ...over,
});

const NOW = new Date("2026-06-11T22:00:00Z");

describe("team name resolution", () => {
  it("normalizes case, accents and punctuation", () => {
    expect(normalizeTeamName("Curaçao")).toBe("curacao");
    expect(normalizeTeamName("Bosnia-Herzegovina")).toBe("bosniaherzegovina");
  });
  it("resolves exact and accent-variant names", () => {
    expect(resolveTeamName("Mexico", teams)).toBe("Mexico");
    expect(resolveTeamName("Curaçao", teams)).toBe("Curaçao");
  });
  it("maps the four known ESPN divergences", () => {
    expect(resolveTeamName("Czechia", teams)).toBe("Czech Republic");
    expect(resolveTeamName("Türkiye", teams)).toBe("Turkey");
    expect(resolveTeamName("Congo DR", teams)).toBe("DR Congo");
    expect(resolveTeamName("Bosnia-Herzegovina", teams)).toBe("Bosnia and Herzegovina");
  });
  it("returns undefined for unknown names", () => {
    expect(resolveTeamName("Atlantis", teams)).toBeUndefined();
  });
});

describe("parseScoreboard", () => {
  // Trimmed real payload from site.api.espn.com (2026-06-11).
  const payload = {
    events: [
      {
        id: "760415",
        date: "2026-06-11T19:00Z",
        name: "South Africa at Mexico",
        competitions: [
          {
            competitors: [
              { homeAway: "home", score: "2", winner: true, team: { displayName: "Mexico" } },
              { homeAway: "away", score: "0", winner: false, team: { displayName: "South Africa" } },
            ],
            status: { type: { name: "STATUS_FULL_TIME", completed: true, detail: "FT" } },
          },
        ],
      },
    ],
  };
  it("extracts id, kickoff, teams, score, status and winner flags", () => {
    expect(parseScoreboard(payload)).toEqual([
      {
        id: "760415", date: "2026-06-11T19:00Z", home: "Mexico", away: "South Africa",
        home_score: 2, away_score: 0, completed: true, status: "STATUS_FULL_TIME", detail: "FT",
        home_winner: true, away_winner: false,
      },
    ]);
  });
  it("throws on malformed payloads instead of guessing", () => {
    expect(() => parseScoreboard({})).toThrow();
    expect(() => parseScoreboard({ events: [{ id: "x" }] })).toThrow();
  });
});

describe("planSync", () => {
  const mexico = fx(1, "Mexico", "South Africa", "2026-06-11T19:00:00Z");

  it("enters a finished group match", () => {
    const plan = planSync([mexico], [], [ev({})], teams, NOW);
    expect(plan.toEnter).toEqual([
      { fixture: mexico, result: { match: 1, status: "final", home_goals: 2, away_goals: 0 } },
    ]);
    expect(plan.conflicts).toEqual([]);
  });

  it("maps ESPN alias names onto the fixture", () => {
    const korea = fx(2, "South Korea", "Czech Republic", "2026-06-12T02:00:00Z");
    const plan = planSync(
      [korea], [],
      [ev({ id: "760414", date: "2026-06-12T02:00Z", home: "South Korea", away: "Czechia", home_score: 1, away_score: 1 })],
      teams, NOW,
    );
    expect(plan.toEnter.map((e) => e.result)).toEqual([
      { match: 2, status: "final", home_goals: 1, away_goals: 1 },
    ]);
  });

  it("leaves already-recorded matches alone when ESPN agrees", () => {
    const recorded: MatchResult = { match: 1, status: "final", home_goals: 2, away_goals: 0 };
    const plan = planSync([mexico], [recorded], [ev({})], teams, NOW);
    expect(plan.toEnter).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it("raises a conflict instead of overwriting a differing recorded result", () => {
    const recorded: MatchResult = { match: 1, status: "final", home_goals: 1, away_goals: 0 };
    const plan = planSync([mexico], [recorded], [ev({})], teams, NOW);
    expect(plan.toEnter).toEqual([]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toContain("recorded 1-0, ESPN says 2-0");
  });

  it("flags finished knockout matches for manual entry instead of entering them", () => {
    const ko = fx(74, "Spain", "Poland", "2026-06-29T20:00:00Z", "r32");
    const plan = planSync(
      [ko], [],
      [ev({ id: "9", date: "2026-06-29T20:00Z", home: "Spain", away: "Poland", home_score: 1, away_score: 1, detail: "FT-Pens" })],
      teams, new Date("2026-06-29T23:00:00Z"),
    );
    expect(plan.toEnter).toEqual([]);
    expect(plan.knockoutPending).toHaveLength(1);
    expect(plan.knockoutPending[0]).toContain("match 74");
  });

  it("refuses kickoff mismatches and unknown teams", () => {
    const wrongTime = planSync([mexico], [], [ev({ date: "2026-06-11T16:00Z" })], teams, NOW);
    expect(wrongTime.toEnter).toEqual([]);
    expect(wrongTime.unmapped).toHaveLength(1);

    const unknown = planSync([mexico], [], [ev({ home: "Atlantis" })], teams, NOW);
    expect(unknown.toEnter).toEqual([]);
    expect(unknown.unmapped).toHaveLength(1);
  });

  it("ignores scheduled/in-play events and tolerates the pre-game score placeholders", () => {
    const plan = planSync(
      [mexico], [],
      [ev({ completed: false, status: "STATUS_SCHEDULED", home_score: 0, away_score: 0 })],
      teams, NOW,
    );
    expect(plan.toEnter).toEqual([]);
    expect(plan.unmapped).toEqual([]);
  });

  it("marks fixtures overdue 12h after kickoff with no finished event", () => {
    const lateNow = new Date("2026-06-12T08:00:00Z");
    const plan = planSync([mexico], [], [], teams, lateNow);
    expect(plan.overdue).toHaveLength(1);
    expect(plan.overdue[0]).toContain("match 1");
  });
});

describe("planSync extra-time finals", () => {
  const ko = fx(82, "Spain", "Poland", "2026-07-01T20:00:00Z", "r32");
  const koNow = new Date("2026-07-02T01:00:00Z");
  const aet = (over: Partial<EspnEvent> = {}): EspnEvent =>
    ev({
      id: "82", date: "2026-07-01T20:00Z", home: "Spain", away: "Poland",
      home_score: 3, away_score: 2, status: "STATUS_FINAL_AET", detail: "AET",
      home_winner: true, away_winner: false, home_score_90: 2, away_score_90: 2,
      ...over,
    });

  it("accepts AET finals and reports the 90' score, cumulative score and advancer", () => {
    const plan = planSync([ko], [], [aet()], teams, koNow);
    expect(plan.unmapped).toEqual([]);
    expect(plan.overdue).toEqual([]);
    expect(plan.knockoutPending).toHaveLength(1);
    expect(plan.knockoutPending[0]).toContain("finished 2-2 after 90'");
    expect(plan.knockoutPending[0]).toContain("3-2 AET");
    expect(plan.knockoutPending[0]).toContain("Spain through");
  });

  it("accepts pens finals as finished", () => {
    const plan = planSync(
      [ko], [],
      [aet({ home_score: 1, away_score: 1, status: "STATUS_FINAL_PEN", detail: "FT-Pens",
             home_winner: false, away_winner: true, home_score_90: 1, away_score_90: 1 })],
      teams, koNow,
    );
    expect(plan.unmapped).toEqual([]);
    expect(plan.knockoutPending).toHaveLength(1);
    expect(plan.knockoutPending[0]).toContain("finished 1-1 after 90'");
    expect(plan.knockoutPending[0]).toContain("Poland through");
  });

  it("audits a recorded AET result against the 90' score, not the cumulative one", () => {
    const recorded: MatchResult = { match: 82, status: "final", home_goals: 2, away_goals: 2, advances: "Spain" };
    const plan = planSync([ko], [recorded], [aet()], teams, koNow);
    expect(plan.conflicts).toEqual([]);
    expect(plan.knockoutPending).toEqual([]);
  });

  it("raises a conflict when the recorded score differs from the 90' score", () => {
    const recorded: MatchResult = { match: 82, status: "final", home_goals: 3, away_goals: 2, advances: "Spain" };
    const plan = planSync([ko], [recorded], [aet()], teams, koNow);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toContain("recorded 3-2, ESPN says 2-2 after 90'");
  });

  it("raises a conflict when the recorded advancer differs from ESPN's winner", () => {
    const recorded: MatchResult = { match: 82, status: "final", home_goals: 2, away_goals: 2, advances: "Poland" };
    const plan = planSync([ko], [recorded], [aet()], teams, koNow);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toContain("recorded advances Poland, ESPN winner is Spain");
  });

  it("degrades gracefully when the 90' score is unavailable", () => {
    const noSummary = aet({ home_score_90: undefined, away_score_90: undefined });
    const pending = planSync([ko], [], [noSummary], teams, koNow);
    expect(pending.knockoutPending).toHaveLength(1);
    expect(pending.knockoutPending[0]).toContain("beyond 90'");
    expect(pending.knockoutPending[0]).toContain("3-2 AET");

    const recorded: MatchResult = { match: 82, status: "final", home_goals: 2, away_goals: 2, advances: "Spain" };
    const audited = planSync([ko], [recorded], [noSummary], teams, koNow);
    expect(audited.conflicts).toEqual([]); // cumulative 3-2 must NOT be compared to the recorded 2-2
  });

  it("never auto-enters a group match claiming an extra-time status", () => {
    const group = fx(9, "Mexico", "South Africa", "2026-06-11T19:00:00Z");
    const plan = planSync([group], [], [aet({ id: "9", date: "2026-06-11T19:00Z", home: "Mexico", away: "South Africa" })], teams, NOW);
    expect(plan.toEnter).toEqual([]);
    expect(plan.unmapped).toHaveLength(1);
  });
});

describe("parseSummaryScore90", () => {
  const summary = (homeLs: number[], awayLs: number[]) => ({
    header: {
      competitions: [
        {
          competitors: [
            { homeAway: "home", linescores: homeLs.map((n) => ({ displayValue: String(n) })) },
            { homeAway: "away", linescores: awayLs.map((n) => ({ displayValue: String(n) })) },
          ],
        },
      ],
    },
  });

  it("sums the two halves for an AET final (4 periods)", () => {
    expect(parseSummaryScore90(summary([0, 2, 0, 1], [1, 1, 0, 0]))).toEqual({ home_90: 2, away_90: 2 });
  });

  it("ignores the shootout entry for a pens final (5 periods)", () => {
    // Real shape from Germany-Paraguay 2026-06-29 (pens 4-3): 5th entry is shootout goals.
    expect(parseSummaryScore90(summary([0, 1, 0, 0, 3], [1, 0, 0, 0, 4]))).toEqual({ home_90: 1, away_90: 1 });
  });

  it("returns undefined for regulation finishes and malformed payloads", () => {
    expect(parseSummaryScore90(summary([2, 0], [0, 0]))).toBeUndefined();
    expect(parseSummaryScore90({})).toBeUndefined();
    expect(parseSummaryScore90({ header: { competitions: [{ competitors: [] }] } })).toBeUndefined();
  });
});

describe("datesToQuery", () => {
  const fixtures = [
    fx(1, "Mexico", "South Africa", "2026-06-11T19:00:00Z"),
    fx(2, "South Korea", "Czech Republic", "2026-06-12T02:00:00Z"),
    fx(3, "Spain", "Poland", "2026-06-20T19:00:00Z"),
  ];
  it("covers each pending past kickoff's UTC date and the day before (ESPN buckets by US Eastern)", () => {
    expect(datesToQuery(fixtures, [], new Date("2026-06-12T05:00:00Z"))).toEqual([
      "20260610", "20260611", "20260612",
    ]);
  });
  it("skips recorded matches and future kickoffs", () => {
    const recorded: MatchResult[] = [{ match: 1, status: "final", home_goals: 2, away_goals: 0 }];
    expect(datesToQuery(fixtures, recorded, new Date("2026-06-11T20:00:00Z"))).toEqual([]);
  });
});
