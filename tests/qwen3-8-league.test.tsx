import { describe, expect, it } from "vitest";
import {
  loadCompetitionLivePredictions,
  loadRoster,
} from "../lib/data";
import { leagueMatchInfo, loadLeagueData } from "../lib/league-aggregate";
import { modelSlug } from "../lib/prompt";
import { loadSeasonPredictions } from "../lib/season-prediction";

const MODEL_ID = "qwen/qwen3.8-max";
const MODEL_SLUG = modelSlug(MODEL_ID);
const COMP_ID = "laliga-2026-27";

describe("Qwen3.8 Max league admission", () => {
  it("never mutates or backfills frozen World Cup, La Liga season-table, or MD1 records", () => {
    expect(loadRoster().map((model) => model.id)).not.toContain(MODEL_ID);
    expect(loadSeasonPredictions(COMP_ID).map((file) => file.model)).not.toContain(MODEL_ID);

    const md1Models = [...loadCompetitionLivePredictions(COMP_ID).values()]
      .flat()
      .filter((file) => file.stage === "md01")
      .map((file) => file.model);
    expect(md1Models).not.toContain(MODEL_ID);
  });

  it("keeps the late entrant outside the locked MD1 field", () => {
    const data = loadLeagueData(COMP_ID);
    const qwen = data.leaderboard.find((entry) => entry.slug === MODEL_SLUG);
    expect(qwen?.joinedRound).toBe("md02");

    const fixture = [...data.fixtures.values()].find((item) => item.stage === "md01")!;
    const info = leagueMatchInfo(data, fixture);
    expect(info.state).toBe("picks");
    expect(info.rows.map((row) => row.slug)).not.toContain(MODEL_SLUG);
  });
});
