import { describe, expect, it } from "vitest";
import {
  applyRefresh,
  clusterRounds,
  ingestSeason,
  normalizeEspnDate,
  parseLeagueScoreboard,
  planRefresh,
  splitRoundByKickoff,
  type LeagueEvent,
} from "../lib/league-fixtures";
import type { Competition, Fixture } from "../lib/types";

const COMP: Competition = {
  id: "test-league",
  kind: "league",
  name: "Test League",
  short_name: "Test",
  season_label: "2026-27",
  espn_slug: "tst.1",
  team_count: 4,
  round_count: 6,
  active: false,
};

let nextId = 1000;
function ev(kickoff: string, home: string, away: string, over?: Partial<LeagueEvent>): LeagueEvent {
  return { espn_id: String(nextId++), kickoff_utc: kickoff, home, away, ...over };
}

/** 4-team double round-robin, one round per Saturday from Aug 1. */
function season(): LeagueEvent[] {
  const rounds: [string, string][][] = [
    [["A", "B"], ["C", "D"]],
    [["A", "C"], ["B", "D"]],
    [["A", "D"], ["B", "C"]],
    [["B", "A"], ["D", "C"]],
    [["C", "A"], ["D", "B"]],
    [["D", "A"], ["C", "B"]],
  ];
  const out: LeagueEvent[] = [];
  rounds.forEach((round, i) => {
    const day = String(1 + i * 7).padStart(2, "0");
    round.forEach(([home, away], j) => {
      out.push(ev(`2026-08-${day}T${j === 0 ? "12" : "15"}:00:00Z`, home, away));
    });
  });
  return out;
}

describe("normalizeEspnDate", () => {
  it("normalizes ESPN minute-precision dates to seconds", () => {
    expect(normalizeEspnDate("2026-08-21T19:00Z")).toBe("2026-08-21T19:00:00Z");
    expect(normalizeEspnDate("2026-08-21T19:00:00Z")).toBe("2026-08-21T19:00:00Z");
  });
  it("throws on garbage", () => {
    expect(() => normalizeEspnDate("not-a-date")).toThrow();
  });
});

describe("parseLeagueScoreboard", () => {
  it("extracts events and skips malformed ones", () => {
    const parsed = parseLeagueScoreboard({
      events: [
        {
          id: "401",
          date: "2026-08-21T19:00Z",
          status: { type: { name: "STATUS_SCHEDULED" } },
          competitions: [
            {
              venue: { fullName: "Emirates Stadium", address: { city: "London" } },
              competitors: [
                { homeAway: "home", team: { displayName: "Arsenal" } },
                { homeAway: "away", team: { displayName: "Coventry City" } },
              ],
            },
          ],
        },
        { id: "402", date: "2026-08-21T19:00Z", competitions: [{ competitors: [] }] },
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      espn_id: "401",
      kickoff_utc: "2026-08-21T19:00:00Z",
      home: "Arsenal",
      away: "Coventry City",
      city: "London",
      stadium: "Emirates Stadium",
      statusName: "STATUS_SCHEDULED",
    });
  });
});

describe("clusterRounds", () => {
  it("recovers rounds from a regular season", () => {
    const rounds = clusterRounds(season());
    expect(rounds).toHaveLength(6);
    for (const round of rounds) expect(round).toHaveLength(2);
  });

  it("splits congested back-to-back rounds via team repetition (Boxing Day)", () => {
    // Two full rounds only one day apart — date-gap clustering would merge them.
    const events = [
      ev("2026-12-26T12:00:00Z", "A", "B"),
      ev("2026-12-26T15:00:00Z", "C", "D"),
      ev("2026-12-27T12:00:00Z", "A", "C"),
      ev("2026-12-27T15:00:00Z", "B", "D"),
    ];
    const rounds = clusterRounds(events);
    expect(rounds).toHaveLength(2);
    expect(rounds[0].map((e) => `${e.home}-${e.away}`)).toEqual(["A-B", "C-D"]);
    expect(rounds[1].map((e) => `${e.home}-${e.away}`)).toEqual(["A-C", "B-D"]);
  });

  it("orders within a round by kickoff", () => {
    const rounds = clusterRounds(season());
    expect(rounds[0][0].kickoff_utc < rounds[0][1].kickoff_utc).toBe(true);
  });
});

describe("ingestSeason", () => {
  it("numbers matches round-major with mdNN stage keys", () => {
    const { fixtures, problems } = ingestSeason(COMP, season());
    expect(problems).toEqual([]);
    expect(fixtures).toHaveLength(12);
    expect(fixtures.map((f) => f.match)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(fixtures[0]).toMatchObject({ stage: "md01", round: 1, home: "A", away: "B" });
    expect(fixtures[11]).toMatchObject({ stage: "md06", round: 6 });
    expect(fixtures.every((f) => typeof f.espn_id === "string")).toBe(true);
  });

  it("flags a fixture deferred out of its matchweek", () => {
    const events = season();
    // Move round 1's C-D deep into round 3's weekend: clustering can no longer
    // reproduce the official shape and the ingest must refuse.
    events[1] = { ...events[1], kickoff_utc: "2026-08-15T18:00:00Z" };
    const { problems } = ingestSeason(COMP, events);
    expect(problems.length).toBeGreaterThan(0);
  });

  it("flags duplicate espn ids and wrong totals", () => {
    const events = season();
    events[3] = { ...events[3], espn_id: events[2].espn_id };
    expect(ingestSeason(COMP, events).problems.some((p) => p.includes("Duplicate"))).toBe(true);
    expect(ingestSeason(COMP, season().slice(0, 11)).problems.some((p) => p.includes("Expected 12"))).toBe(
      true,
    );
  });
});

describe("splitRoundByKickoff", () => {
  it("separates kicked-off matches from still-predictable ones", () => {
    const { fixtures } = ingestSeason(COMP, season());
    const round1 = fixtures.filter((f) => f.round === 1);
    const during = new Date("2026-08-01T13:00:00Z"); // between the two round-1 kickoffs
    const { included, excluded } = splitRoundByKickoff(round1, during);
    expect(excluded.map((f) => f.match)).toEqual([1]);
    expect(included.map((f) => f.match)).toEqual([2]);
    // Before the round: everything predictable; after: everything excluded.
    expect(splitRoundByKickoff(round1, new Date("2026-07-30T00:00:00Z")).excluded).toEqual([]);
    expect(splitRoundByKickoff(round1, new Date("2026-08-02T00:00:00Z")).included).toEqual([]);
  });
});

describe("planRefresh / applyRefresh", () => {
  /** One fixture set + a feed derived from THAT set (ids must correspond). */
  function setup(): { fx: Fixture[]; events: LeagueEvent[] } {
    const fx = ingestSeason(COMP, season()).fixtures;
    const events = fx.map((f) => ({
      espn_id: f.espn_id!,
      kickoff_utc: f.kickoff_utc,
      home: f.home,
      away: f.away,
    }));
    return { fx, events };
  }

  it("is a no-op on an identical feed", () => {
    const { fx, events } = setup();
    const plan = planRefresh(fx, events);
    expect(plan.kickoffUpdates).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.newEvents).toEqual([]);
  });

  it("updates a moved kickoff and applies it", () => {
    const { fx, events } = setup();
    events[0] = { ...events[0], kickoff_utc: "2026-08-02T11:00:00Z" };
    const plan = planRefresh(fx, events);
    expect(plan.kickoffUpdates).toEqual([
      { match: fx[0].match, from: fx[0].kickoff_utc, to: "2026-08-02T11:00:00Z" },
    ]);
    const applied = applyRefresh(fx, plan);
    expect(applied[0].kickoff_utc).toBe("2026-08-02T11:00:00Z");
    expect(applied[0].round).toBe(fx[0].round); // rounds are sticky
    expect(applied[1]).toEqual(fx[1]);
  });

  it("flags team drift as a conflict instead of applying it", () => {
    const { fx, events } = setup();
    events[0] = { ...events[0], home: "Zeta" };
    const plan = planRefresh(fx, events);
    expect(plan.conflicts.some((c) => c.includes("teams changed"))).toBe(true);
    expect(plan.kickoffUpdates).toEqual([]);
  });

  it("reports unknown new events and vanished fixtures", () => {
    const { fx, events } = setup();
    const vanished = events.pop()!;
    events.push(ev("2027-05-30T15:00:00Z", "X", "Y"));
    const plan = planRefresh(fx, events);
    expect(plan.newEvents).toHaveLength(1);
    expect(plan.conflicts.some((c) => c.includes(`espn ${vanished.espn_id}`))).toBe(true);
  });
});
