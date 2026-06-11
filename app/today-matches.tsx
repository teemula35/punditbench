"use client";

/**
 * "Today's matches" — resolved in the VISITOR'S browser so it rolls over at
 * midnight on its own (the site is statically exported; a build-time "today"
 * would freeze at the last deploy). Receives every fixture as lightweight
 * pre-rendered strings and filters to kickoffs on the visitor's local date.
 * Renders nothing on days without matches and before hydration (the section
 * appears client-side, same pattern as the consent banner).
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

export function TodayMatches({ cards }: { cards: TodayCard[] }) {
  const [today, setToday] = useState<TodayCard[] | null>(null);

  useEffect(() => {
    const now = new Date();
    const isToday = (iso: string) => {
      const k = new Date(iso);
      return (
        k.getFullYear() === now.getFullYear() &&
        k.getMonth() === now.getMonth() &&
        k.getDate() === now.getDate()
      );
    };
    setToday(cards.filter((c) => isToday(c.kickoff_utc)));
  }, [cards]);

  if (!today || today.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-zinc-100">Today&apos;s matches</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {today.map((c) => (
          <Link
            key={c.match}
            href={`/matches/${c.match}/`}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition-colors hover:border-emerald-400/40"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {c.stageLabel} · {c.kickoffLabel}
            </p>
            <p className="mt-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-zinc-100">
              <span className="truncate">{c.homeLabel}</span>
              {c.scoreLabel ? (
                <span className="shrink-0 font-bold tabular-nums text-emerald-400">
                  {c.scoreLabel}
                </span>
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
        ))}
      </div>
    </section>
  );
}
