import React, { type ReactNode } from "react";
import Link from "next/link";
import { loadCompetitions } from "../lib/data";

export function LeagueBridge({
  modelCount,
  children,
}: {
  modelCount: number;
  children?: ReactNode;
}) {
  const liveCompetitions = loadCompetitions().filter((competition) => competition.active);

  return (
    <section className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Live · Season 2026-27
        </p>
        <Link href="/leagues/" className="text-sm text-emerald-400 hover:underline">
          Explore the leagues →
        </Link>
      </div>
      <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
        Five European leagues, two pre-registered tracks
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Premier League, La Liga, Serie A, Ligue 1 and Bundesliga are live for 2026-27 with{" "}
        {modelCount} current league models. Each competition has a locked pre-season table and
        form-aware matchday picks, with every prediction hashed before the relevant kickoff.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {liveCompetitions.map((competition) => (
          <Link
            key={competition.id}
            href={`/leagues/${competition.id}/`}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-emerald-400/50 hover:text-emerald-300"
          >
            {competition.short_name}
          </Link>
        ))}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}
