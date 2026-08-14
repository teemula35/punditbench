import type { MetadataRoute } from "next";
import { sitemapRoutes } from "@/lib/sitemap";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapRoutes().map((route) => ({
    url: `${SITE_URL}${route}`,
  }));
}
