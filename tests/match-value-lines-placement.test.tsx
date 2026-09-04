import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeagueMatchInfo } from "../lib/league-aggregate";

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
        status: string;
        home_goals?: number;
        away_goals?: number;
      },
  info: undefined as unknown as LeagueMatchInfo,
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
  leagueMatchInfo: () => fixtureState.info,
}));

import LeagueMatchPage from "../app/leagues/[comp]/matches/[match]/page";

describe("match-page Value Lines placement", () => {
  beforeEach(() => {
    fixtureState.result = undefined;
    fixtureState.info = {
      state: "picks",
      rows: [
        {
          model: {
            id: "test/model",
            label: "Test Model",
            vendor: "Test Vendor",
            tier: "mid",
          },
          slug: "test-model",
          prediction: { match: fixtureState.fixture.match, home_goals: 1, away_goals: 0 },
        },
      ],
      lockedAt: "2026-09-04T03:00:00Z",
      consensus: { home: 1, away: 0, count: 1, outOf: 1 },
      split: { home: 1, draw: 0, away: 0, outOf: 1 },
    };
  });

  it("places the tracked Value Lines offer after locked consensus on an upcoming match", async () => {
    const html = renderToStaticMarkup(
      await LeagueMatchPage({
        params: Promise.resolve({ comp: fixtureState.competition.id, match: "1" }),
      }),
    );

    expect(html).toContain("See Value Lines");
    expect(html.match(/data-analytics-event="value_lines_click"/g)).toHaveLength(1);
    const consensusIndex = html.indexOf("Most predicted:");
    const cardIndex = html.indexOf("See Value Lines");
    const tableIndex = html.indexOf("<table");
    expect(consensusIndex).toBeGreaterThanOrEqual(0);
    expect(cardIndex).toBeGreaterThan(consensusIndex);
    expect(tableIndex).toBeGreaterThan(cardIndex);
  });

  it.each([
    { label: "pending", info: { state: "pending", rows: [] } as LeagueMatchInfo },
    {
      label: "manifest-excluded",
      info: { state: "excluded", rows: [], excludedReason: "not pre-registered" } as LeagueMatchInfo,
    },
  ])("does not market Value Lines in the $label state", async ({ info }) => {
    fixtureState.info = info;

    const html = renderToStaticMarkup(
      await LeagueMatchPage({
        params: Promise.resolve({ comp: fixtureState.competition.id, match: "1" }),
      }),
    );

    expect(html).not.toContain("See Value Lines");
    expect(html).not.toContain('data-analytics-event="value_lines_click"');
  });

  it("does not market Value Lines when a locked round has zero valid picks", async () => {
    fixtureState.info = {
      state: "picks",
      rows: [],
      lockedAt: "2026-09-04T03:00:00Z",
    };

    const html = renderToStaticMarkup(
      await LeagueMatchPage({
        params: Promise.resolve({ comp: fixtureState.competition.id, match: "1" }),
      }),
    );

    expect(html).not.toContain("See Value Lines");
    expect(html).not.toContain('data-analytics-event="value_lines_click"');
  });

  it("does not market Value Lines without valid pre-kickoff lock metadata", async () => {
    fixtureState.info.lockedAt = undefined;

    const html = renderToStaticMarkup(
      await LeagueMatchPage({
        params: Promise.resolve({ comp: fixtureState.competition.id, match: "1" }),
      }),
    );

    expect(html).not.toContain("See Value Lines");
    expect(html).not.toContain('data-analytics-event="value_lines_click"');
  });

  it("does not market Value Lines when the lock is not before kickoff", async () => {
    fixtureState.info.lockedAt = fixtureState.fixture.kickoff_utc;

    const html = renderToStaticMarkup(
      await LeagueMatchPage({
        params: Promise.resolve({ comp: fixtureState.competition.id, match: "1" }),
      }),
    );

    expect(html).not.toContain("See Value Lines");
    expect(html).not.toContain('data-analytics-event="value_lines_click"');
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

  it("does not market an upcoming Value Line when a final result has no displayable score", async () => {
    fixtureState.result = {
      match: fixtureState.fixture.match,
      status: "final",
    };

    const html = renderToStaticMarkup(
      await LeagueMatchPage({
        params: Promise.resolve({ comp: fixtureState.competition.id, match: "1" }),
      }),
    );

    expect(html).not.toContain("See Value Lines");
    expect(html).not.toContain('data-analytics-event="value_lines_click"');
  });

  it("fails closed when a result record has an unrecognized status", async () => {
    fixtureState.result = {
      match: fixtureState.fixture.match,
      status: "delayed",
    };

    const html = renderToStaticMarkup(
      await LeagueMatchPage({
        params: Promise.resolve({ comp: fixtureState.competition.id, match: "1" }),
      }),
    );

    expect(html).not.toContain("Upcoming — kicks off");
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
