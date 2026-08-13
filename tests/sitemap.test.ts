import { describe, expect, it } from "vitest";
import { loadCompetitionFixtures, loadCompetitions } from "../lib/data";
import { sitemapRoutes } from "../lib/sitemap";

describe("sitemapRoutes", () => {
  it("includes every league landing page and every league fixture page", () => {
    const routes = new Set(sitemapRoutes());

    for (const competition of loadCompetitions()) {
      expect(routes).toContain(`/leagues/${competition.id}/`);
      for (const fixture of loadCompetitionFixtures(competition.id)) {
        expect(routes).toContain(`/leagues/${competition.id}/matches/${fixture.match}/`);
      }
    }
  });
});
