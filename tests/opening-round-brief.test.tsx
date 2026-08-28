import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OpeningRoundBriefPage, { metadata } from "../app/briefs/opening-round-2026/page";
import LeagueMatchdayPage from "../app/leagues/[comp]/matchdays/[round]/page";
import LeaguePage from "../app/leagues/[comp]/page";
import LeaguesPage from "../app/leagues/page";

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

describe("current product links on league surfaces", () => {
  it("links the league hub to Value Lines before its explanation", () => {
    const html = renderToStaticMarkup(<LeaguesPage />);

    expect(html.match(new RegExp(`href="${PRODUCT_URL}"`, "g"))).toHaveLength(1);
    expect(html).toContain("See Value Lines");
    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("See Value Lines"));
    expect(html.indexOf("See Value Lines")).toBeLessThan(
      html.indexOf("Unlike the knowledge-only World Cup prompts"),
    );
  });

  it("links each league landing page to Value Lines before its leaderboard", async () => {
    const html = renderToStaticMarkup(
      await LeaguePage({ params: Promise.resolve({ comp: "laliga-2026-27" }) }),
    );

    expect(html.match(new RegExp(`href="${PRODUCT_URL}"`, "g"))).toHaveLength(1);
    expect(html).toContain("See Value Lines");
    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("See Value Lines"));
    expect(html.indexOf("See Value Lines")).toBeLessThan(html.indexOf("Season leaderboard"));
  });

  it("links each matchday page to Value Lines before its fixtures", async () => {
    const html = renderToStaticMarkup(
      await LeagueMatchdayPage({
        params: Promise.resolve({ comp: "epl-2026-27", round: "1" }),
      }),
    );

    expect(html.match(new RegExp(`href="${PRODUCT_URL}"`, "g"))).toHaveLength(1);
    expect(html).toContain("See Value Lines");
    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("See Value Lines"));
    expect(html.indexOf("See Value Lines")).toBeLessThan(
      html.indexOf('aria-label="Matchday 1 fixtures"'),
    );
  });
});
