"use client";

/**
 * "Today's matches" — resolved in the VISITOR'S browser so it rolls over at
 * midnight on its own (the site is statically exported; a build-time "today"
 * would freeze at the last deploy). Receives every fixture as lightweight
 * pre-rendered strings and filters to kickoffs on the visitor's local date,
 * plus a "Latest results" strip so finished matches stay visible after the
 * local midnight rollover. Renders nothing on days without matches and before
 * hydration (the section appears client-side, same pattern as the consent
 * banner).
 */
import { useEffect, useState } from "react";
import Link from "next/link";

export interface TodayCard {
  match: number;
  kickoff_utc: string;
  stageLabel: string;
  homeLabel: string;
  awayLabel: string;
  kickoffLabel: string;
  /** "2–1" once the result is in; undefined while upcoming. */
  scoreLabel?: string;
  consensusLine?: string;
  splitLine?: string;
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
      href={`/matches/${c.match}/`}
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

export function TodayMatches({ cards }: { cards: TodayCard[] }) {
  const [view, setView] = useState<{
    today: { c: TodayCard; status: CardStatus }[];
    latest: { c: TodayCard; status: CardStatus }[];
  } | null>(null);

  useEffect(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const isToday = (iso: string) => {
      const k = new Date(iso);
      return (
        k.getFullYear() === now.getFullYear() &&
        k.getMonth() === now.getMonth() &&
        k.getDate() === now.getDate()
      );
    };
    const statusOf = (c: TodayCard): CardStatus => {
      if (c.scoreLabel) return "played";
      const ko = Date.parse(c.kickoff_utc);
      if (nowMs >= ko + IN_PLAY_MS) return "awaiting";
      if (nowMs >= ko) return "inplay";
      return "upcoming";
    };
    const today = cards.filter((c) => isToday(c.kickoff_utc)).map((c) => ({ c, status: statusOf(c) }));
    const shown = new Set(today.map((t) => t.c.match));
    const latest = cards
      .filter(
        (c) =>
          c.scoreLabel && !shown.has(c.match) && nowMs - Date.parse(c.kickoff_utc) < LATEST_MS,
      )
      .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc) || b.match - a.match)
      .slice(0, 8)
      .map((c) => ({ c, status: "played" as CardStatus }));
    setView({ today, latest });
  }, [cards]);

  if (!view || (view.today.length === 0 && view.latest.length === 0)) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-zinc-100">Today&apos;s matches</h2>
      {view.today.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {view.today.map(({ c, status }) => (
            <Card key={c.match} c={c} status={status} />
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
              <Card key={c.match} c={c} status={status} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
