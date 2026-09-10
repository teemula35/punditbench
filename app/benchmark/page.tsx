import type { Metadata } from "next";
import LeaderboardPage, { metadata as homepageMetadata } from "../page";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  ...homepageMetadata,
  alternates: { canonical: "/benchmark/" },
  openGraph: { ...homepageMetadata.openGraph, url: `${SITE_URL}/benchmark/` },
};

/** The original overview remains at the root until an explicit hosting-mode change. */
export default function BenchmarkOverview() {
  return <div id="archive"><LeaderboardPage /></div>;
}
