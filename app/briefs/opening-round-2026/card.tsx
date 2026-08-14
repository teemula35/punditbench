import React from "react";
import Link from "next/link";

export function OpeningRoundBriefCard() {
  return (
    <section className="rounded-lg border border-sky-400/20 bg-sky-400/5 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-sky-300">
        Complete free sample
      </p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-100">
        40 models, 304 picks, and one exact score
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        The free sample audits the World Cup round of 16 and keeps the failures in. All 38 models
        with valid files backed Brazil over Norway; all 38 were wrong. It also covers the scorecard,
        rank moves, lock/hash record, provider failures and source files. The five-league
        opening-round brief will use the same format. It costs €5 once, with no subscription.
      </p>
      <Link
        href="/briefs/opening-round-2026/"
        className="mt-4 inline-flex text-sm font-semibold text-sky-300 hover:underline"
      >
        Read the complete free sample and offer →
      </Link>
    </section>
  );
}
