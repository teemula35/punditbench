import type { MetadataRoute } from "next";
import { loadFixtures, loadRoster } from "@/lib/data";
import { modelSlug } from "@/lib/prompt";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "/",
    "/matches/",
    "/groups/",
    "/models/",
    "/methodology/",
    "/changelog/",
    "/about/",
  ];
  const matchRoutes = loadFixtures().map((f) => `/matches/${f.match}/`);
  const modelRoutes = loadRoster().map((m) => `/models/${modelSlug(m.id)}/`);

  return [...staticRoutes, ...matchRoutes, ...modelRoutes].map((route) => ({
    url: `${SITE_URL}${route}`,
  }));
}
