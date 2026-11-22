import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LeagueMatchdayPage from "../app/leagues/[comp]/matchdays/[round]/page";
import LeagueMatchPage from "../app/leagues/[comp]/matches/[match]/page";
import { loadHomepageLeagueCards } from "../lib/home-match-cards";
import { leagueMatchInfo, loadLeagueData } from "../lib/league-aggregate";
import { leagueMatchMetadataPickSummary } from "../lib/league-match-metadata";

const COMP_ID = "ligue1-2026-27";

describe("post-lock fixture reversal disclosure", () => {
  it("uses distinct metadata wording for archived, unscored picks", () => {
    const data = loadLeagueData(COMP_ID);
    const fixture = data.fixtures.get(3)!;
    const info = leagueMatchInfo(data, fixture);
    expect(leagueMatchMetadataPickSummary(info, 43)).toBe(
      "43 archived pre-registered LLM picks, excluded from scoring",
    );
  });

  it("shows the corrected real fixture and the locked orientation without reinterpreting picks", async () => {
    const html = renderToStaticMarkup(
      await LeagueMatchPage({ params: Promise.resolve({ comp: COMP_ID, match: "3" }) }),
    );
    expect(html).toContain("Stade Rennais");
    expect(html).toContain("Paris Saint-Germain");
    expect(html).toContain("Roazhon Park");
    expect(html).toContain("The locked fixture was Paris Saint-Germain vs Stade Rennais");
    expect(html).toContain("not swapped or reinterpreted");
    expect(html).toContain("excluded from benchmark scoring and the opening-round brief fulfilment denominator");
    expect(html).toContain("Paris Saint-Germain");
    expect(html).toContain("Stade Rennais (as locked)");
    expect(html).not.toContain(">Points<");
    expect(html).not.toContain(">Breakdown<");
    expect(html).not.toContain("See Value Lines");
    expect(html).not.toContain('data-analytics-event="value_lines_click"');
  });

  it("marks the exception on the matchday page", async () => {
    const html = renderToStaticMarkup(
      await LeagueMatchdayPage({ params: Promise.resolve({ comp: COMP_ID, round: "1" }) }),
    );
    expect(html).toContain("Stade Rennais");
    expect(html).toContain("Roazhon Park");
    expect(html).toContain("Fixture corrected after lock");
    expect(html).toContain("Paris Saint-Germain vs Stade Rennais");
    expect(html).toContain("archived but unscored");
  });

  it("never presents the locked consensus beneath the reversed homepage labels", () => {
    const cards = loadHomepageLeagueCards(new Date("2026-08-23T12:00:00Z"));
    expect(cards.some((card) => card.id === `${COMP_ID}:3`)).toBe(false);
  });
});
