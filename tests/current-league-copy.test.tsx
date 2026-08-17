import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeagueBridge } from "../app/league-bridge";
import { SeasonLaunchCalendar } from "../app/season-2026-27/launch-calendar";
import { SEASON_LAUNCHES } from "../app/season-2026-27/launches";

describe("current league-season copy", () => {
  it("describes all five live leagues using the evolving league-roster count", () => {
    const html = renderToStaticMarkup(<LeagueBridge modelCount={42} />);

    expect(html).toContain("Live · Season 2026-27");
    expect(html).toMatch(
      /<h1[^>]*>Five European leagues, two pre-registered tracks<\/h1>/,
    );
    expect(html).toContain("Premier League, La Liga, Serie A, Ligue 1 and Bundesliga are live");
    expect(html).toContain("42 current league models");
    expect(html).toContain("locked pre-season table");
    expect(html).toContain("form-aware matchday picks");
    expect(html.match(/href="\/leagues\/[^\"]+"/g)).toHaveLength(5);
    for (const id of [
      "epl-2026-27",
      "laliga-2026-27",
      "seriea-2026-27",
      "ligue1-2026-27",
      "bundesliga-2026-27",
    ]) {
      expect(html).toContain(`href="/leagues/${id}"`);
    }
    expect(html).not.toContain("with the Bundesliga and Champions League following");
  });

  it("shows the verified first-kickoff date for every configured league", () => {
    expect(SEASON_LAUNCHES.map(({ league, when }) => [league, when])).toEqual([
      ["La Liga", "Matchday 1 — August 15"],
      ["Premier League", "Matchday 1 — August 21"],
      ["Ligue 1", "Matchday 1 — August 21"],
      ["Serie A", "Matchday 1 — August 22"],
      ["Bundesliga", "Matchday 1 — August 28"],
    ]);

    const html = renderToStaticMarkup(<SeasonLaunchCalendar />);
    expect(html).not.toContain("When the 2026-27 fixtures are published");
    expect(html).not.toContain("Champions League");
  });
});
