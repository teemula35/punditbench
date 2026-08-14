import { describe, expect, it } from "vitest";
import { loadCompetitionFixtures, loadCompetitions } from "../lib/data";
import { sitemapRoutes } from "../lib/sitemap";

describe("sitemapRoutes", () => {
  it("includes the opening-round brief and complete free sample", () => {
    expect(sitemapRoutes()).toContain("/briefs/opening-round-2026/");
    expect(sitemapRoutes()).toContain("/briefs/opening-round-2026/refunds/");
    expect(sitemapRoutes()).toContain("/briefs/opening-round-2026/privacy/");
  });

  it("includes every league landing page and every league fixture page", () => {
    const routes = new Set(sitemapRoutes());

    for (const competition of loadCompetitions()) {
      expect(routes).toContain(`/leagues/${competition.id}/`);
      for (const fixture of loadCompetitionFixtures(competition.id)) {
        expect(routes).toContain(`/leagues/${competition.id}/matches/${fixture.match}/`);
      }
    }
  });

  it("includes one matchday preview page for every configured competition round", () => {
    const routes = new Set(sitemapRoutes());

    for (const competition of loadCompetitions()) {
      for (let round = 1; round <= competition.round_count; round++) {
        expect(routes).toContain(`/leagues/${competition.id}/matchdays/${round}/`);
      }
    }
  });
});
