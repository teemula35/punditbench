import { loadCompetitionFixtures, loadCompetitions, loadFixtures, loadModelProfiles } from "./data";
import { modelSlug } from "./prompt";

export function sitemapRoutes(): string[] {
  const staticRoutes = [
    "/",
    "/leagues/",
    "/matches/",
    "/groups/",
    "/models/",
    "/methodology/",
    "/changelog/",
    "/about/",
    "/season-2026-27/",
    "/briefs/opening-round-2026/",
    "/briefs/opening-round-2026/refunds/",
    "/briefs/opening-round-2026/privacy/",
  ];
  const matchRoutes = loadFixtures().map((f) => `/matches/${f.match}/`);
  const modelRoutes = loadModelProfiles().map((m) => `/models/${modelSlug(m.id)}/`);
  const leagueRoutes = loadCompetitions().flatMap((competition) => [
    `/leagues/${competition.id}/`,
    ...Array.from(
      { length: competition.round_count },
      (_, index) => `/leagues/${competition.id}/matchdays/${index + 1}/`,
    ),
    ...loadCompetitionFixtures(competition.id).map(
      (fixture) => `/leagues/${competition.id}/matches/${fixture.match}/`,
    ),
  ]);

  return [...staticRoutes, ...matchRoutes, ...modelRoutes, ...leagueRoutes];
}
