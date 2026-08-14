import { describe, expect, it } from "vitest";
import { leagueMatchMetadataPickSummary } from "../lib/league-match-metadata";
import type { LeagueMatchInfo } from "../lib/league-aggregate";
import type { RosterModel } from "../lib/types";

const model: RosterModel = {
  id: "test/model",
  label: "Model",
  vendor: "Test",
  tier: "mid",
};

describe("league match metadata pick wording", () => {
  it("counts only stored predictions in a locked round as pre-registered picks", () => {
    const info: LeagueMatchInfo = {
      state: "picks",
      rows: [
        {
          model,
          slug: "test-model",
          prediction: { match: 1, home_goals: 1, away_goals: 0 },
        },
        { model: { ...model, id: "test/missing" }, slug: "test-missing" },
      ],
    };

    expect(leagueMatchMetadataPickSummary(info, 99)).toBe("1 pre-registered LLM pick");
  });

  it("describes the eligible field for a pending round", () => {
    expect(leagueMatchMetadataPickSummary({ state: "pending", rows: [] }, 7)).toBe(
      "7 LLMs are eligible to predict",
    );
  });

  it("says excluded matches have no pre-registered picks", () => {
    expect(
      leagueMatchMetadataPickSummary(
        { state: "excluded", rows: [], excludedReason: "Not locked before kickoff." },
        7,
      ),
    ).toBe("No pre-registered LLM picks");
  });
});
