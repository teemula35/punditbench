"use client";

/**
 * "Today's matches" prerenders from a build timestamp so direct links exist
 * without hydration, then re-resolves in the visitor's browser so the section
 * rolls over on the visitor's local date. Receives a bounded window of locked
 * fixtures as lightweight strings, plus recent results; renders nothing when
 * neither set has a card.
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { HomeMatchCard } from "@/lib/home-match-cards";

export type TodayCard = HomeMatchCard;

export type MatchAnalyticsReporter = (
  command: "event",
  eventName: string,
  params?: Record<string, unknown>,
) => void;

function activeAnalyticsReporter(): MatchAnalyticsReporter | undefined {
  if (typeof window === "undefined") return undefined;
  return window.gtag;
}

/** Records discovery only when the visitor has already enabled analytics. */
export function trackMatchSelection(
  card: TodayCard,
  report: MatchAnalyticsReporter | undefined = activeAnalyticsReporter(),
): void {
  report?.("event", "select_content", {
    content_type: "league_match",
    item_id: card.id,
    link_url: card.href,
  });
}

type CardStatus = "played" | "inplay" | "awaiting" | "upcoming";

/** 90' + half-time + stoppage — past this a scoreless match is over, its result
 * just hasn't landed yet (the hourly sync enters and deploys it). */
const IN_PLAY_MS = 130 * 60 * 1000;
/** How far back "Latest results" reaches for finished matches not shown under today. */
const LATEST_MS = 48 * 60 * 60 * 1000;

function Card({ c, status }: { c: TodayCard; status: CardStatus }) {
  return (
    <Link
      href={c.href}
      data-analytics-event="select_content"
      onClick={() => trackMatchSelection(c)}
      className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition-colors hover:border-emerald-400/40"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {c.stageLabel} · {c.kickoffLabel}
      </p>
      <p className="mt-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-zinc-100">
        <span className="truncate">{c.homeLabel}</span>
        {status === "played" ? (
          <span className="shrink-0 font-bold tabular-nums text-emerald-400">{c.scoreLabel}</span>
        ) : status === "inplay" ? (
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            In play
          </span>
        ) : status === "awaiting" ? (
          <span className="shrink-0 text-[11px] italic text-zinc-500">awaiting score</span>
        ) : (
          <span className="shrink-0 text-zinc-600">vs</span>
        )}
      </p>
      <p className="text-sm font-medium text-zinc-100">
        <span className="truncate">{c.awayLabel}</span>
      </p>
      {(c.consensusLine || c.splitLine) && (
        <p className="mt-2 border-t border-zinc-800/70 pt-2 text-xs text-zinc-500">
          {c.consensusLine}
          {c.consensusLine && c.splitLine && <span className="text-zinc-700"> · </span>}
          {c.splitLine}
        </p>
      )}
    </Link>
  );
}

export interface TodayMatchView {
  today: { c: TodayCard; status: CardStatus }[];
  latest: { c: TodayCard; status: CardStatus }[];
}

export interface LocalMidnightScheduler {
  now: () => Date;
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (timer: unknown) => void;
}

const systemLocalMidnightScheduler: LocalMidnightScheduler = {
  now: () => new Date(),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (timer) =>
    globalThis.clearTimeout(timer as ReturnType<typeof globalThis.setTimeout>),
};

/** Runs immediately after hydration, then again at every visitor-local midnight. */
export function startLocalMidnightUpdates(
  update: (now: Date) => void,
  scheduler: LocalMidnightScheduler = systemLocalMidnightScheduler,
): () => void {
  let stopped = false;
  let hasTimer = false;
  let timer: unknown;

  const updateAndSchedule = () => {
    if (stopped) return;

    const now = scheduler.now();
    update(now);
    if (stopped) return;

    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    timer = scheduler.setTimeout(updateAndSchedule, nextMidnight.getTime() - now.getTime());
    hasTimer = true;
  };

  updateAndSchedule();

  return () => {
    if (stopped) return;
    stopped = true;
    if (hasTimer) scheduler.clearTimeout(timer);
  };
}

/** Pure date selection, kept separate from hydration for deterministic tests. */
export function selectTodayMatches(
  cards: TodayCard[],
  now: Date,
  dateBasis: "local" | "utc" = "local",
): TodayMatchView {
  const nowMs = now.getTime();
  const isToday = (iso: string) => {
    const kickoff = new Date(iso);
    if (dateBasis === "utc") {
      return (
        kickoff.getUTCFullYear() === now.getUTCFullYear() &&
        kickoff.getUTCMonth() === now.getUTCMonth() &&
        kickoff.getUTCDate() === now.getUTCDate()
      );
    }
    return (
      kickoff.getFullYear() === now.getFullYear() &&
      kickoff.getMonth() === now.getMonth() &&
      kickoff.getDate() === now.getDate()
    );
  };
  const statusOf = (c: TodayCard): CardStatus => {
    if (c.scoreLabel) return "played";
    const ko = Date.parse(c.kickoff_utc);
    if (nowMs >= ko + IN_PLAY_MS) return "awaiting";
    if (nowMs >= ko) return "inplay";
    return "upcoming";
  };
  // Complete by design: with several leagues locked at once a single day can
  // hold 15–20 fixtures, and the section title promises all of them. The
  // serialized payload budget upstream is the only bound.
  const today = cards
    .filter((c) => isToday(c.kickoff_utc))
    .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.id.localeCompare(b.id))
    .map((c) => ({ c, status: statusOf(c) }));
  const shown = new Set(today.map((t) => t.c.id));
  const latest = cards
    .filter(
      (c) =>
        c.scoreLabel && !shown.has(c.id) && nowMs - Date.parse(c.kickoff_utc) < LATEST_MS,
    )
    .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc) || b.id.localeCompare(a.id))
    .slice(0, 8)
    .map((c) => ({ c, status: "played" as CardStatus }));
  return { today, latest };
}

export function TodayMatches({
  cards,
  initialNow,
}: {
  cards: TodayCard[];
  /** Build-time timestamp so direct links exist in prerendered HTML. */
  initialNow?: string;
}) {
  const [view, setView] = useState<TodayMatchView | null>(() =>
    initialNow ? selectTodayMatches(cards, new Date(initialNow), "utc") : null,
  );

  useEffect(
    () =>
      startLocalMidnightUpdates((now) => {
        setView(selectTodayMatches(cards, now));
      }),
    [cards],
  );

  if (!view || (view.today.length === 0 && view.latest.length === 0)) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-zinc-100">Today&apos;s matches</h2>
      {view.today.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {view.today.map(({ c, status }) => (
            <Card key={c.id} c={c} status={status} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No matches today.</p>
      )}
      {view.latest.length > 0 && (
        <>
          <h3 className="mb-3 mt-6 text-sm font-semibold text-zinc-400">Latest results</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {view.latest.map(({ c, status }) => (
              <Card key={c.id} c={c} status={status} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
