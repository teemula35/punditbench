import React from "react";

export const VALUE_LINES_URL =
  "https://pb-feed-private-446043664034.europe-north1.run.app/";

export function ValueLinesCard() {
  return (
    <section className="rounded-lg border border-sky-400/20 bg-sky-400/5 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-sky-300">
        Private subscription · €9/month
      </p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-100">
        Fair 1/X/2 odds for upcoming matches
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Value Lines turns PunditBench&apos;s locked five-league forecasts into calibrated
        probabilities and fair odds before eligible kickoffs. Each issue preserves its source and
        timing record, and misses remain part of the performance history.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={VALUE_LINES_URL}
          className="inline-flex rounded-md bg-sky-300 px-4 py-2 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-200"
        >
          See Value Lines →
        </a>
        <span className="text-xs text-zinc-500">Delivered by email · Cancel any time</span>
      </div>
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-zinc-500">
        18+ only. Availability and location restrictions are shown before checkout. Informational
        forecasts, not betting advice; no profit is promised.
      </p>
    </section>
  );
}
