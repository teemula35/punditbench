import { describe, expect, it } from "vitest";
import {
  datesToQuery,
  normalizeTeamName,
  parseScoreboard,
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
  it("extracts id, kickoff, teams, score and status", () => {
    expect(parseScoreboard(payload)).toEqual([
      {
        id: "760415", date: "2026-06-11T19:00Z", home: "Mexico", away: "South Africa",
        home_score: 2, away_score: 0, completed: true, status: "STATUS_FULL_TIME", detail: "FT",
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
