import React, { type ReactNode } from "react";
import Link from "next/link";

export function LeagueBridge({
  modelCount,
  children,
}: {
  modelCount: number;
  children?: ReactNode;
}) {
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
      <h2 className="mt-2 text-lg font-semibold text-zinc-100">
        The same benchmark now covers five European leagues
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Premier League, La Liga, Serie A, Ligue 1 and Bundesliga are live for 2026-27. Every
        matchday, all {modelCount} current league models predict every scoreline — shown the current
        table and each team&apos;s recent form — with picks locked and hashed about 36 hours before the
        first kickoff.
      </p>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}
