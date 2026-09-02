import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtureState = vi.hoisted(() => ({
  competition: {
    id: "test-league-2026-27",
    name: "Test League 2026–27",
    short_name: "Test League",
  },
  fixture: {
    match: 1,
    stage: "MD1",
    round: 1,
    home: "Home FC",
    away: "Away FC",
    kickoff_utc: "2026-09-05T15:00:00Z",
    stadium: "Test Ground",
    city: "Test City",
  },
  result: undefined as
    | undefined
    | {
        match: number;
        status: "final" | "voided";
        home_goals?: number;
        away_goals?: number;
      },
}));

vi.mock("../lib/data", () => ({
  loadCompetitions: () => [fixtureState.competition],
  loadCompetitionFixtures: () => [fixtureState.fixture],
}));

vi.mock("../lib/league-aggregate", () => ({
  loadLeagueData: () => ({
    comp: fixtureState.competition,
    fixtures: new Map([[fixtureState.fixture.match, fixtureState.fixture]]),
    results: new Map(fixtureState.result ? [[fixtureState.result.match, fixtureState.result]] : []),
  }),
  leagueMatchInfo: () => ({
    state: "picks",
    rows: [],
    lockedAt: "2026-09-04T03:00:00Z",
    consensus: { home: 1, away: 0, count: 20, outOf: 40 },
    split: { home: 24, draw: 8, away: 8, outOf: 40 },
  }),
}));

import LeagueMatchPage from "../app/leagues/[comp]/matches/[match]/page";

describe("match-page Value Lines placement", () => {
  beforeEach(() => {
    fixtureState.result = undefined;
  });

  it("places the tracked Value Lines offer after locked consensus on an upcoming match", async () => {
    const html = renderToStaticMarkup(
      await LeagueMatchPage({
        params: Promise.resolve({ comp: fixtureState.competition.id, match: "1" }),
      }),
    );

    expect(html).toContain("See Value Lines");
    expect(html).toContain('data-analytics-event="value_lines_click"');
    expect(html.indexOf("Most predicted:")).toBeLessThan(html.indexOf("See Value Lines"));
    expect(html.indexOf("See Value Lines")).toBeLessThan(html.indexOf("<table"));
  });

  it("does not market an upcoming Value Line after the match is final", async () => {
    fixtureState.result = {
      match: fixtureState.fixture.match,
      status: "final",
      home_goals: 1,
      away_goals: 0,
    };

    const html = renderToStaticMarkup(
      await LeagueMatchPage({
        params: Promise.resolve({ comp: fixtureState.competition.id, match: "1" }),
      }),
    );

    expect(html).not.toContain("See Value Lines");
    expect(html).not.toContain('data-analytics-event="value_lines_click"');
  });

  it("does not market an upcoming Value Line for a voided match", async () => {
    fixtureState.result = {
      match: fixtureState.fixture.match,
      status: "voided",
    };

    const html = renderToStaticMarkup(
      await LeagueMatchPage({
        params: Promise.resolve({ comp: fixtureState.competition.id, match: "1" }),
      }),
    );

    expect(html).not.toContain("See Value Lines");
    expect(html).not.toContain('data-analytics-event="value_lines_click"');
  });
});
