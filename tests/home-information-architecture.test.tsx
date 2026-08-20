import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), "utf8").replace(/\s+/g, " ");
}

describe("homepage information architecture", () => {
  it("places the live league product before the intact World Cup archive", () => {
    const source = readSource("app", "page.tsx");
    const leagueBridge = source.indexOf("<LeagueBridge");
    const briefCard = source.indexOf("<OpeningRoundBriefCard");
    const todayMatches = source.indexOf("<TodayMatches");
    const lockAlertInterest = source.indexOf("<LockAlertInterest");
    const archive = source.indexOf('id="world-cup-archive"');

    expect(leagueBridge).toBeGreaterThanOrEqual(0);
    expect(briefCard).toBeGreaterThan(leagueBridge);
    expect(todayMatches).toBeGreaterThan(briefCard);
    expect(lockAlertInterest).toBeGreaterThan(todayMatches);
    expect(archive).toBeGreaterThan(lockAlertInterest);
    expect(source).toContain("loadHomepageLeagueCards");
    expect(source).toContain("World Cup 2026 · Frozen archive");
    expect(source).not.toContain("<h1");
    expect(source).toContain('href="/matches/"');
    expect(source).toContain('href="/groups/"');
    expect(source).toContain('href="/models/"');
  });

  it("publishes league-first homepage metadata without hiding the archive", () => {
    const source = readSource("app", "page.tsx");

    expect(source).toContain("export const metadata: Metadata");
    expect(source).toContain("title: `${SITE_NAME} — five live 2026-27 leagues, predictions locked before kickoff`");
    expect(source).toContain("The completed 2026 World Cup remains fully browsable as a frozen archive.");
    expect(source).toContain('alternates: { canonical: "/" }');
    expect(source).toContain("url: SITE_URL");
  });

  it("makes live leagues primary in navigation and qualifies archive links", () => {
    const source = readSource("app", "layout.tsx");
    const liveLeagues = source.indexOf('{ href: "/leagues/", label: "Live leagues" }');
    const archive = source.indexOf('{ href: "/#world-cup-archive", label: "World Cup archive" }');

    expect(liveLeagues).toBeGreaterThanOrEqual(0);
    expect(archive).toBeGreaterThan(liveLeagues);
    expect(source).toContain('{ href: "/matches/", label: "WC matches" }');
    expect(source).toContain('{ href: "/groups/", label: "WC groups" }');
    expect(source).not.toContain('{ href: "/", label: "Leaderboard" }');
  });

  it("uses a dual-purpose sharing card for the live leagues and archive", () => {
    const source = readSource("app", "opengraph-image.tsx");

    expect(source).toContain("Five European leagues. Predictions locked before kickoff.");
    expect(source).toContain("Pre-season tables + form-aware matchday picks");
    expect(source).toContain("World Cup 2026 · frozen archive");
    expect(source).toContain("five live leagues and the frozen 2026 World Cup archive");
  });

  it("uses current dual-purpose defaults instead of World Cup-only site metadata", () => {
    const source = readSource("app", "layout.tsx");

    expect(source).toContain("live league benchmark and World Cup archive");
    expect(source).toContain("Pre-registered AI football predictions across five live European leagues");
    expect(source).not.toContain("40 LLMs predict the 2026 World Cup");
    expect(source).not.toContain("url: SITE_URL");
    expect(source).not.toContain("/og.png");
  });
});
