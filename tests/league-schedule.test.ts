import { describe, expect, it } from "vitest";
import {
  LOCK_WINDOW_HOURS,
  dueRounds,
  isRoundDue,
  nextUnlockedRound,
  roundFirstKickoff,
} from "../lib/league-schedule";
import type { Fixture, LiveManifest, MatchdayKey } from "../lib/types";
import { mdKey } from "../lib/types";

let nextMatch = 1;
function fx(stage: MatchdayKey, kickoff: string): Fixture {
  return {
    match: nextMatch++,
    stage,
    home: "H",
    away: "A",
    kickoff_utc: kickoff,
    city: "Testville",
  };
}

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * `roundCount` weekly rounds, two matches each, from Sat 2026-08-01. Each
 * round lists its LATER kickoff (15:00) before its first (12:00) so nothing
 * can lean on array order.
 */
function season(roundCount: number): Fixture[] {
  const out: Fixture[] = [];
  const start = Date.parse("2026-08-01T12:00:00Z");
  for (let r = 1; r <= roundCount; r++) {
    const noon = start + (r - 1) * 7 * 86_400_000;
    out.push(fx(mdKey(r), iso(noon + 3 * 3_600_000)));
    out.push(fx(mdKey(r), iso(noon)));
  }
  return out;
}

/** Manifest with the given matchday numbers locked. */
function locked(...rounds: number[]): LiveManifest {
  const manifest: LiveManifest = { excluded: {}, rounds: {} };
  for (const r of rounds) {
    manifest.rounds[mdKey(r)] = { locked_at: "2026-07-01T00:00:00Z", models: 38, excluded: [] };
  }
  return manifest;
}

describe("nextUnlockedRound", () => {
  it("picks the lowest-numbered unlocked round regardless of fixture order", () => {
    expect(nextUnlockedRound([...season(12)].reverse(), locked(1))).toBe("md02");
  });

  it("skips locked rounds", () => {
    expect(nextUnlockedRound(season(12), locked(1, 2, 3))).toBe("md04");
  });

  it("crosses the md09 -> md10 boundary", () => {
    expect(nextUnlockedRound(season(12), locked(1, 2, 3, 4, 5, 6, 7, 8, 9))).toBe("md10");
  });

  it("orders rounds numerically, not as strings", () => {
    // String sort puts "md10" before "md2"; the numeric order is 2 < 10.
    const fixtures = [fx("md10", "2026-10-03T12:00:00Z"), fx("md2", "2026-08-08T12:00:00Z")];
    expect(nextUnlockedRound(fixtures, locked())).toBe("md2");
  });

  it("returns undefined when every round is locked", () => {
    expect(nextUnlockedRound(season(3), locked(1, 2, 3))).toBeUndefined();
  });

  it("returns undefined for empty fixtures", () => {
    expect(nextUnlockedRound([], locked())).toBeUndefined();
  });

  it("does not resurface a locked round for a postponed far-future match", () => {
    const fixtures = season(4);
    // Postpone one md01 match beyond every other round's kickoff.
    fixtures[1] = { ...fixtures[1], kickoff_utc: "2026-12-19T15:00:00Z" };
    expect(nextUnlockedRound(fixtures, locked(1))).toBe("md02");
  });
});

describe("roundFirstKickoff", () => {
  it("returns the earliest kickoff in the round", () => {
    expect(roundFirstKickoff(season(2), "md02")).toBe("2026-08-08T12:00:00Z");
  });

  it("returns undefined for a round with no fixtures", () => {
    expect(roundFirstKickoff(season(2), "md05")).toBeUndefined();
  });
});

describe("isRoundDue", () => {
  it("locks 36 hours before kickoff by default", () => {
    expect(LOCK_WINDOW_HOURS).toBe(36);
  });

  it("is due when the first kickoff is inside the window", () => {
    // First kickoff 2026-08-01T12:00Z is 12h ahead.
    expect(isRoundDue(season(2), locked(), "md01", new Date("2026-08-01T00:00:00Z"))).toBe(true);
  });

  it("is not due when the first kickoff is beyond the window", () => {
    const fixtures = [fx(mdKey(1), "2026-08-02T13:00:00Z")]; // 37h ahead
    expect(isRoundDue(fixtures, locked(), "md01", new Date("2026-08-01T00:00:00Z"))).toBe(false);
  });

  it("is due when the first kickoff has already passed (late run)", () => {
    expect(isRoundDue(season(2), locked(), "md01", new Date("2026-08-02T00:00:00Z"))).toBe(true);
  });

  it("is never due once the round is locked", () => {
    expect(isRoundDue(season(2), locked(1), "md01", new Date("2026-08-01T11:00:00Z"))).toBe(false);
  });

  it("honours a custom window", () => {
    const fixtures = [fx(mdKey(1), "2026-08-03T00:00:00Z")]; // 48h ahead
    const now = new Date("2026-08-01T00:00:00Z");
    expect(isRoundDue(fixtures, locked(), "md01", now)).toBe(false);
    expect(isRoundDue(fixtures, locked(), "md01", now, 72)).toBe(true);
  });

  it("is not due for a round with no fixtures", () => {
    expect(isRoundDue(season(2), locked(), "md05", new Date("2026-08-01T00:00:00Z"))).toBe(false);
  });
});

describe("dueRounds", () => {
  it("returns at most one round per competition", () => {
    // A giant window makes every round due; only the next one may lock.
    const due = dueRounds(
      [{ compId: "epl-2026-27", fixtures: season(3), manifest: locked() }],
      new Date("2026-08-01T00:00:00Z"),
      24 * 365,
    );
    expect(due).toEqual([
      { compId: "epl-2026-27", round: "md01", firstKickoff: "2026-08-01T12:00:00Z" },
    ]);
  });

  it("sorts due rounds by first kickoff", () => {
    const due = dueRounds(
      [
        { compId: "later", fixtures: season(1), manifest: locked() }, // 12:00
        { compId: "sooner", fixtures: [fx(mdKey(1), "2026-08-01T06:00:00Z")], manifest: locked() },
      ],
      new Date("2026-08-01T00:00:00Z"),
    );
    expect(due.map((d) => d.compId)).toEqual(["sooner", "later"]);
    expect(due.map((d) => d.firstKickoff)).toEqual([
      "2026-08-01T06:00:00Z",
      "2026-08-01T12:00:00Z",
    ]);
  });

  it("skips competitions that are locked ahead, out of window, or without fixtures", () => {
    const due = dueRounds(
      [
        { compId: "all-locked", fixtures: season(2), manifest: locked(1, 2) },
        { compId: "not-yet", fixtures: [fx(mdKey(1), "2026-09-01T12:00:00Z")], manifest: locked() },
        { compId: "no-fixtures", fixtures: [], manifest: locked() },
      ],
      new Date("2026-08-01T00:00:00Z"),
    );
    expect(due).toEqual([]);
  });

  it("moves past a locked round with a postponed match", () => {
    const fixtures = season(4);
    fixtures[1] = { ...fixtures[1], kickoff_utc: "2026-12-19T15:00:00Z" }; // md01, postponed
    // md02's first kickoff (Aug 8 12:00) is 24h ahead; md01 is locked.
    const due = dueRounds(
      [{ compId: "epl-2026-27", fixtures, manifest: locked(1) }],
      new Date("2026-08-07T12:00:00Z"),
    );
    expect(due).toEqual([
      { compId: "epl-2026-27", round: "md02", firstKickoff: "2026-08-08T12:00:00Z" },
    ]);
  });
});
