import { describe, expect, it } from "vitest";
import {
  leagueJoinRound,
  leagueRosterForRound,
  leagueSeasonRoster,
  leagueStartLabel,
  modelEligibleForLeagueRound,
} from "../lib/league-participation";
import type { RosterModel } from "../lib/types";

const early: RosterModel = {
  id: "test/early",
  label: "Early",
  vendor: "Test",
  tier: "mid",
};

const late: RosterModel = {
  id: "test/late",
  label: "Late",
  vendor: "Test",
  tier: "flagship",
  league_joined_round: {
    "league-a": "md02",
  },
};

describe("league participation windows", () => {
  it("defaults to Matchday 1 when a competition has no override", () => {
    expect(leagueJoinRound(early, "league-a")).toBe("md01");
    expect(leagueJoinRound(late, "league-b")).toBe("md01");
  });

  it("applies a competition-specific join round boundary", () => {
    expect(leagueJoinRound(late, "league-a")).toBe("md02");
    expect(modelEligibleForLeagueRound(late, "league-a", "md01")).toBe(false);
    expect(modelEligibleForLeagueRound(late, "league-a", "md02")).toBe(true);
    expect(modelEligibleForLeagueRound(late, "league-a", "md03")).toBe(true);
    expect(leagueStartLabel(late, "league-a")).toBe("since Matchday 2");
    expect(leagueStartLabel(early, "league-a")).toBe("from Matchday 1");
  });

  it("excludes a late entrant from the La Liga season field but includes it in a default-MD1 competition", () => {
    const laLigaLate: RosterModel = {
      ...late,
      league_joined_round: { "laliga-2026-27": "md02" },
    };
    expect(
      leagueSeasonRoster([early, laLigaLate], "laliga-2026-27").map((model) => model.id),
    ).toEqual(["test/early"]);
    expect(
      leagueSeasonRoster([early, laLigaLate], "epl-2026-27").map((model) => model.id),
    ).toEqual(["test/early", "test/late"]);
  });

  it("filters the runner roster before an ineligible model can be called", () => {
    expect(leagueRosterForRound([early, late], "league-a", "md01").map((model) => model.id)).toEqual([
      "test/early",
    ]);
    expect(leagueRosterForRound([early, late], "league-a", "md02").map((model) => model.id)).toEqual([
      "test/early",
      "test/late",
    ]);
  });
});
