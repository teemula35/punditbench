import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BenchmarkOverview, { metadata } from "../app/benchmark/page";
import { sitemapRoutes } from "../lib/sitemap";

describe("benchmark overview address", () => {
  it("preserves the existing benchmark and both archive anchors at its dedicated address", () => {
    const html = renderToStaticMarkup(<BenchmarkOverview />);
    expect(html).toContain('id="archive"'); expect(html).toContain('id="world-cup-archive"');
    expect(html).toContain("World Cup 2026"); expect(html).toContain("Leaderboard");
    for (const href of ["/leagues", "/matches", "/groups", "/models"]) expect(html).toMatch(new RegExp(`href="${href}/?"`));
    expect(metadata.alternates).toEqual({ canonical: "/benchmark/" });
    expect(metadata.openGraph).toMatchObject({ url: "https://punditbench.com/benchmark/" });
    expect(sitemapRoutes()).toContain("/benchmark/");
  });
  it("keeps root navigation outside the benchmark client router and archive navigation inside the benchmark", () => {
    const layout = fs.readFileSync("app/layout.tsx", "utf8");
    expect(layout).toContain('<a href="/" className="shrink-0">');
    expect(layout).not.toContain('<Link href="/"');
    expect(layout).toContain('{ href: "/benchmark/#world-cup-archive", label: "World Cup archive" }');
    for (const file of ["app/not-found.tsx", "app/confirmed/page.tsx", "app/subscribed/page.tsx"]) {
      const source = fs.readFileSync(file, "utf8"); expect(source).toContain('href="/benchmark/"'); expect(source).not.toContain('href="/"');
    }
  });
});
