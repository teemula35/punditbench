import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import OpeningRoundBriefPage, { metadata } from "../app/briefs/opening-round-2026/page";
import LeagueMatchdayPage from "../app/leagues/[comp]/matchdays/[round]/page";
import LeaguePage from "../app/leagues/[comp]/page";
import LeaguesPage from "../app/leagues/page";
import HomePage from "../app/page";
import RootLayout, { metadata as layoutMetadata } from "../app/layout";

vi.mock("../app/globals.css", () => ({}));

const PRODUCT_URL = "https://pb-feed-private-446043664034.europe-north1.run.app/";

describe("historical opening-round brief page", () => {
  it("preserves the complete sample and has no live purchase path", () => {
    const html = renderToStaticMarkup(<OpeningRoundBriefPage />);

    expect(html).toContain("Historical format sample");
    expect(html).toContain("Complete free sample");
    expect(html).toContain("World Cup 2026 round of 16");
    expect(html).toContain("38/40");
    expect(html).toContain("Lock and hash audit");
    expect(html).toContain("former opening-round brief offer is closed");
    expect(html).not.toContain("Buy the brief");
    expect(html).not.toContain("buy.stripe.com");
  });

  it("ignores the former checkout environment", () => {
    process.env.PB_BRIEF_CHECKOUT_URL = "https://buy.stripe.com/obsolete";
    try {
      const html = renderToStaticMarkup(<OpeningRoundBriefPage />);
      expect(html).not.toContain("buy.stripe.com");
      expect(html).not.toContain("Buy the brief");
    } finally {
      delete process.env.PB_BRIEF_CHECKOUT_URL;
    }
  });

  it("sets route-specific archive metadata", () => {
    expect(metadata.alternates).toEqual({ canonical: "/briefs/opening-round-2026/" });
    expect(metadata.description).toContain("historical sample");
    expect(metadata.twitter).toMatchObject({
      card: "summary",
      title: "40 models, 304 picks, and one exact score",
    });
  });
});

describe("league pages after product-link retirement", () => {
  it("keeps the homepage and navigation without the retired offer", () => {
    const html = renderToStaticMarkup(<RootLayout><HomePage /></RootLayout>);
    expect(html).not.toContain(PRODUCT_URL);
    expect(html).not.toContain("Value Lines");
    expect(html).toContain("World Cup archive");
    expect(html).toContain("Live leagues");
    expect(layoutMetadata.description).not.toContain("subscription");
  });
  it("keeps the league hub without the retired product promotion", () => {
    const html = renderToStaticMarkup(<LeaguesPage />);
    expect(html).not.toContain(PRODUCT_URL);
    expect(html).not.toContain("Value Lines");
    expect(html).toContain("Unlike the knowledge-only World Cup prompts");
  });
  it("keeps league standings without the retired product promotion", async () => {
    const html = renderToStaticMarkup(await LeaguePage({ params: Promise.resolve({ comp: "laliga-2026-27" }) }));
    expect(html).not.toContain(PRODUCT_URL);
    expect(html).not.toContain("Value Lines");
    expect(html).toContain("Season leaderboard");
  });
  it("keeps matchday fixtures without the retired product promotion", async () => {
    const html = renderToStaticMarkup(await LeagueMatchdayPage({ params: Promise.resolve({ comp: "epl-2026-27", round: "1" }) }));
    expect(html).not.toContain(PRODUCT_URL);
    expect(html).not.toContain("Value Lines");
    expect(html).toContain('aria-label="Matchday 1 fixtures"');
  });
});
