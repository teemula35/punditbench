import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  selectTodayMatches,
  startLocalMidnightUpdates,
  trackMatchSelection,
  TodayMatches,
  type MatchAnalyticsReporter,
  type TodayCard,
} from "../app/today-matches";
import {
  loadHomepageLeagueCards,
  MAX_SERIALIZED_HOME_MATCH_CARDS,
  selectSerializedHomeMatchCards,
} from "../lib/home-match-cards";

function card(id: string, href: string, kickoff: string): TodayCard {
  return {
    id,
    href,
    kickoff_utc: kickoff,
    stageLabel: "League · Matchday 1",
    homeLabel: "Home",
    awayLabel: "Away",
    kickoffLabel: "19 Aug · 19:00 UTC",
  };
}

function fakeMidnightScheduler(initialNow: string) {
  type FakeTimer = {
    callback: () => void;
    delayMs: number;
    cleared: boolean;
  };

  let now = new Date(initialNow);
  const timers: FakeTimer[] = [];

  return {
    scheduler: {
      now: () => new Date(now),
      setTimeout: (callback: () => void, delayMs: number) => {
        const timer = { callback, delayMs, cleared: false };
        timers.push(timer);
        return timer;
      },
      clearTimeout: (timer: unknown) => {
        (timer as FakeTimer).cleared = true;
      },
    },
    setNow: (nextNow: string) => {
      now = new Date(nextNow);
    },
    timers,
  };
}

describe("today's league matches", () => {
  it("keeps same-numbered matches from different leagues distinct", () => {
    const cards = [
      card("laliga-2026-27:9", "/leagues/laliga-2026-27/matches/9/", "2026-08-19T19:00:00Z"),
      card("epl-2026-27:9", "/leagues/epl-2026-27/matches/9/", "2026-08-19T20:00:00Z"),
    ];

    const view = selectTodayMatches(cards, new Date("2026-08-19T12:00:00Z"));

    expect(view.today.map(({ c }) => [c.id, c.href])).toEqual([
      ["laliga-2026-27:9", "/leagues/laliga-2026-27/matches/9/"],
      ["epl-2026-27:9", "/leagues/epl-2026-27/matches/9/"],
    ]);
  });

  it("shows at most eight of today's matches in kickoff order", () => {
    const cards = Array.from({ length: 9 }, (_, index) => {
      const hour = String(20 - index).padStart(2, "0");
      return card(
        `league:${index}`,
        `/leagues/league/matches/${index}/`,
        `2026-08-19T${hour}:00:00Z`,
      );
    });

    const view = selectTodayMatches(cards, new Date("2026-08-19T12:00:00Z"));

    expect(view.today).toHaveLength(8);
    expect(view.today.map(({ c }) => c.kickoff_utc)).toEqual(
      [...cards]
        .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc))
        .slice(0, 8)
        .map((c) => c.kickoff_utc),
    );
  });

  it("builds direct league cards only from locked prediction rounds", () => {
    const cards = loadHomepageLeagueCards(new Date("2026-08-19T12:00:00Z"));

    expect(cards).toContainEqual(
      expect.objectContaining({
        id: "laliga-2026-27:9",
        href: "/leagues/laliga-2026-27/matches/9/",
        stageLabel: "La Liga · Matchday 1",
        homeLabel: "Atlético Madrid",
        awayLabel: "Málaga",
        consensusLine: "Consensus 2–0 · 21 of 42",
        splitLine: "42/42 back Atlético Madrid",
      }),
    );
    expect(cards.some((c) => c.id.startsWith("epl-2026-27:"))).toBe(false);
  });

  it("retains postponed future fixtures from an already locked round", () => {
    const cards = loadHomepageLeagueCards(new Date("2026-08-19T12:00:00Z"));

    expect(cards.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        "laliga-2026-27:1",
        "laliga-2026-27:3",
        "laliga-2026-27:5",
        "laliga-2026-27:8",
      ]),
    );
  });

  it("keeps completed results inside the recent window only", () => {
    const cards = loadHomepageLeagueCards(new Date("2026-08-19T12:00:00Z"));

    expect(cards).toContainEqual(
      expect.objectContaining({ id: "laliga-2026-27:7", scoreLabel: "1–1" }),
    );
    expect(cards.some((c) => c.id === "laliga-2026-27:2")).toBe(false);
  });

  it("caps the serialized payload without letting recent results evict locked future fixtures", () => {
    const referenceTime = new Date("2026-08-19T12:00:00Z");
    const future = Array.from({ length: MAX_SERIALIZED_HOME_MATCH_CARDS - 1 }, (_, index) =>
      card(
        `future:${index}`,
        `/leagues/league/matches/future-${index}/`,
        new Date(referenceTime.getTime() + (index + 1) * 60_000).toISOString(),
      ),
    );
    const recentResults = Array.from({ length: 10 }, (_, index) => ({
      ...card(
        `result:${index}`,
        `/leagues/league/matches/result-${index}/`,
        new Date(referenceTime.getTime() - (index + 1) * 60_000).toISOString(),
      ),
      scoreLabel: "1–0",
    }));

    const payload = selectSerializedHomeMatchCards(
      [...recentResults, ...future],
      referenceTime,
    );

    expect(payload).toHaveLength(MAX_SERIALIZED_HOME_MATCH_CARDS);
    expect(future.every((futureCard) => payload.includes(futureCard))).toBe(true);
    expect(payload.filter((payloadCard) => payloadCard.scoreLabel)).toHaveLength(1);
  });

  it("reports a consent-gated match-card selection without changing the destination", () => {
    const report = vi.fn();
    const selected = card(
      "laliga-2026-27:9",
      "/leagues/laliga-2026-27/matches/9/",
      "2026-08-19T19:00:00Z",
    );

    trackMatchSelection(selected, report);

    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith("event", "select_content", {
      content_type: "league_match",
      item_id: "laliga-2026-27:9",
      link_url: "/leagues/laliga-2026-27/matches/9/",
    });
    expect(selected.href).not.toContain("utm_");
  });

  it("does nothing by default when consent analytics has not loaded", () => {
    const browserWindow: { gtag?: MatchAnalyticsReporter } = {};
    const selected = card(
      "laliga-2026-27:9",
      "/leagues/laliga-2026-27/matches/9/",
      "2026-08-19T19:00:00Z",
    );
    vi.stubGlobal("window", browserWindow);

    try {
      expect(() => trackMatchSelection(selected)).not.toThrow();
      expect(browserWindow.gtag).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("recomputes and reschedules at each visitor-local midnight", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    const fake = fakeMidnightScheduler("2026-08-19T06:59:30Z");
    const cards = [
      card("local-aug-18", "/matches/local-aug-18/", "2026-08-19T06:30:00Z"),
      card("local-aug-19", "/matches/local-aug-19/", "2026-08-19T07:30:00Z"),
      card("local-aug-20", "/matches/local-aug-20/", "2026-08-20T07:30:00Z"),
    ];
    const selectedIds: string[][] = [];
    let stop = () => {};

    try {
      stop = startLocalMidnightUpdates((now) => {
        selectedIds.push(selectTodayMatches(cards, now).today.map(({ c }) => c.id));
      }, fake.scheduler);

      expect(selectedIds).toEqual([["local-aug-18"]]);
      expect(fake.timers.map(({ delayMs }) => delayMs)).toEqual([30_000]);

      fake.setNow("2026-08-19T07:00:00Z");
      fake.timers[0].callback();

      expect(selectedIds).toEqual([["local-aug-18"], ["local-aug-19"]]);
      expect(fake.timers.map(({ delayMs }) => delayMs)).toEqual([30_000, 86_400_000]);

      fake.setNow("2026-08-20T07:00:00Z");
      fake.timers[1].callback();

      expect(selectedIds).toEqual([
        ["local-aug-18"],
        ["local-aug-19"],
        ["local-aug-20"],
      ]);
      expect(fake.timers.map(({ delayMs }) => delayMs)).toEqual([
        30_000,
        86_400_000,
        86_400_000,
      ]);
    } finally {
      stop();
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it("cancels the active local-midnight timer and ignores a stale callback", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "Asia/Kathmandu";
    const fake = fakeMidnightScheduler("2026-08-18T18:14:45Z");
    const update = vi.fn();

    try {
      const stop = startLocalMidnightUpdates(update, fake.scheduler);
      const staleCallback = fake.timers[0].callback;

      expect(fake.timers[0].delayMs).toBe(15_000);
      stop();

      expect(fake.timers[0].cleared).toBe(true);
      staleCallback();
      expect(update).toHaveBeenCalledOnce();
      expect(fake.timers).toHaveLength(1);
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it("prerenders direct match links before hydration", () => {
    const selected = {
      ...card(
        "laliga-2026-27:9",
        "/leagues/laliga-2026-27/matches/9/",
        "2026-08-19T19:00:00Z",
      ),
      consensusLine: "Consensus 2–0 · 21 of 42",
    };

    const html = renderToStaticMarkup(
      <TodayMatches cards={[selected]} initialNow="2026-08-19T12:00:00Z" />,
    );

    expect(html).toContain('href="/leagues/laliga-2026-27/matches/9"');
    expect(html).toContain('data-analytics-event="select_content"');
    expect(html).toContain("Consensus 2–0 · 21 of 42");
  });

  it("prerenders the same UTC-boundary selection in every host timezone", () => {
    const selected = card(
      "laliga-2026-27:9",
      "/leagues/laliga-2026-27/matches/9/",
      "2026-08-19T23:30:00Z",
    );
    const previousTimezone = process.env.TZ;

    try {
      process.env.TZ = "UTC";
      const utcHtml = renderToStaticMarkup(
        <TodayMatches cards={[selected]} initialNow="2026-08-19T00:30:00Z" />,
      );

      process.env.TZ = "America/Los_Angeles";
      const pacificHtml = renderToStaticMarkup(
        <TodayMatches cards={[selected]} initialNow="2026-08-19T00:30:00Z" />,
      );

      expect(pacificHtml).toBe(utcHtml);
      expect(utcHtml).toContain('href="/leagues/laliga-2026-27/matches/9"');
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });
});
