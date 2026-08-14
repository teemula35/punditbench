import { loadCompetitionFixtures, loadCompetitions, loadFixtures, loadModelProfiles } from "./data";
import { modelSlug } from "./prompt";

export function sitemapRoutes(): string[] {
  const staticRoutes = [
    "/",
    "/matches/",
    "/groups/",
    "/models/",
    "/methodology/",
    "/changelog/",
    "/about/",
    "/season-2026-27/",
  ];
  const matchRoutes = loadFixtures().map((f) => `/matches/${f.match}/`);
  const modelRoutes = loadModelProfiles().map((m) => `/models/${modelSlug(m.id)}/`);
  const leagueRoutes = loadCompetitions().flatMap((competition) => [
    `/leagues/${competition.id}/`,
    ...loadCompetitionFixtures(competition.id).map(
      (fixture) => `/leagues/${competition.id}/matches/${fixture.match}/`,
    ),
  ]);

  return [...staticRoutes, ...matchRoutes, ...modelRoutes, ...leagueRoutes];
}
