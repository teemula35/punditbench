import { describe, expect, it } from "vitest";
import { planLeagueSync, type EspnEvent } from "../lib/sync";
import type { Fixture, MatchResult } from "../lib/types";

const NOW = new Date("2026-08-23T12:00:00Z");

function fixture(over: Partial<Fixture> = {}): Fixture {
  return {
    match: 1,
    stage: "md01",
    round: 1,
    home: "Arsenal",
    away: "Coventry City",
    kickoff_utc: "2026-08-21T19:00:00Z",
    city: "London",
    espn_id: "401",
    ...over,
  };
}

function event(over: Partial<EspnEvent> = {}): EspnEvent {
  return {
    id: "401",
    date: "2026-08-21T19:00Z",
    home: "Arsenal",
    away: "Coventry City",
    home_score: 3,
    away_score: 1,
    completed: true,
    status: "STATUS_FULL_TIME",
    detail: "FT",
    ...over,
  };
}

describe("planLeagueSync", () => {
  it("auto-enters a finished league match by ESPN id (no knockout gate)", () => {
    const plan = planLeagueSync([fixture()], [], [event()], NOW);
    expect(plan.toEnter).toHaveLength(1);
    expect(plan.toEnter[0].result).toEqual({
      match: 1,
      status: "final",
      home_goals: 3,
      away_goals: 1,
    });
    expect(plan.conflicts).toEqual([]);
    expect(plan.unmapped).toEqual([]);
  });

  it("ignores events that are not completed", () => {
    const plan = planLeagueSync(
      [fixture({ kickoff_utc: "2026-08-23T11:00:00Z" })],
      [],
      [event({ completed: false, status: "STATUS_IN_PROGRESS" })],
      NOW,
    );
    expect(plan.toEnter).toEqual([]);
    expect(plan.overdue).toEqual([]); // kicked off 1h ago, not overdue yet
  });

  it("audits an existing result: silent on agreement, conflict on mismatch", () => {
    const recorded: MatchResult = { match: 1, status: "final", home_goals: 3, away_goals: 1 };
    const agree = planLeagueSync([fixture()], [recorded], [event()], NOW);
    expect(agree.toEnter).toEqual([]);
    expect(agree.conflicts).toEqual([]);

    const disagree = planLeagueSync(
      [fixture()],
      [{ ...recorded, home_goals: 2 }],
      [event()],
      NOW,
    );
    expect(disagree.conflicts).toHaveLength(1);
    expect(disagree.conflicts[0]).toContain("recorded 2-1");
    expect(disagree.toEnter).toEqual([]);
  });

  it("reports an unknown ESPN id instead of guessing", () => {
    const plan = planLeagueSync([fixture()], [], [event({ id: "999" })], NOW);
    expect(plan.toEnter).toEqual([]);
    expect(plan.unmapped.some((u) => u.includes("999"))).toBe(true);
  });

  it("flags team drift on a matched id as a conflict, never entering", () => {
    const plan = planLeagueSync([fixture()], [], [event({ home: "Chelsea" })], NOW);
    expect(plan.toEnter).toEqual([]);
    expect(plan.conflicts.some((c) => c.includes("Chelsea"))).toBe(true);
  });

  it("flags a completed event with an unexpected status", () => {
    const plan = planLeagueSync([fixture()], [], [event({ status: "STATUS_ABANDONED" })], NOW);
    expect(plan.toEnter).toEqual([]);
    expect(plan.unmapped.some((u) => u.includes("STATUS_ABANDONED"))).toBe(true);
  });

  it("marks fixtures overdue 12h after kickoff with no finished event", () => {
    // Kickoff Aug 21 19:00Z, NOW Aug 23 12:00Z -> 41h, no event at all.
    const plan = planLeagueSync([fixture()], [], [], NOW);
    expect(plan.overdue).toHaveLength(1);
    // A postponed match behaves the same until the fixtures refresh moves its
    // kickoff into the future — then the overdue alert clears naturally.
    const moved = planLeagueSync(
      [fixture({ kickoff_utc: "2026-09-30T19:00:00Z" })],
      [],
      [],
      NOW,
    );
    expect(moved.overdue).toEqual([]);
  });

  it("dedupes events repeated across queried dates", () => {
    const plan = planLeagueSync([fixture()], [], [event(), event()], NOW);
    expect(plan.toEnter).toHaveLength(1);
  });
});
