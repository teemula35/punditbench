import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  trackValueLinesClick,
  ValueLinesCard,
  VALUE_LINES_URL,
} from "../app/value-lines-card";
import OpeningRoundBriefPage from "../app/briefs/opening-round-2026/page";

describe("current Value Lines product surface", () => {
  it("sends visitors to the live €9 monthly subscription service", () => {
    const html = renderToStaticMarkup(<ValueLinesCard />);

    expect(html).toContain(
      'href="https://pb-feed-private-446043664034.europe-north1.run.app/"',
    );
    expect(html).toContain("€9/month");
    expect(html).toContain("Fair 1/X/2 odds");
    expect(html).toContain("Delivered by email");
    expect(html).toContain("See Value Lines");
    expect(html).toContain('data-analytics-event="value_lines_click"');
    expect(html).not.toContain("location restrictions");
    expect(html).not.toContain("opening-round brief");
    expect(html).not.toContain("€5");
  });

  it("records a consent-gated Value Lines click with its source page", () => {
    const report = vi.fn();

    expect(trackValueLinesClick("/leagues/laliga-2026-27", report)).toBe(true);
    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith("event", "value_lines_click", {
      source_path: "/leagues/laliga-2026-27",
      destination_url: VALUE_LINES_URL,
      transport_type: "beacon",
    });
  });

  it("does not claim a click measurement when consent analytics is unavailable", () => {
    expect(trackValueLinesClick("/", undefined)).toBe(false);
  });

  it("keeps the old brief as a free historical sample with no purchase control", () => {
    const html = renderToStaticMarkup(<OpeningRoundBriefPage />);

    expect(html).toContain("Historical format sample");
    expect(html).toContain("Complete free sample");
    expect(html).not.toContain("Buy the brief");
    expect(html).not.toContain("buy.stripe.com");
    expect(html).not.toContain("€5 once");
  });
});
