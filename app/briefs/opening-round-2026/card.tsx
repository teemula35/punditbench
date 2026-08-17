import React from "react";
import Link from "next/link";

export function OpeningRoundBriefCard() {
  return (
    <section className="rounded-lg border border-sky-400/20 bg-sky-400/5 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-sky-300">
        €5 once · Complete free sample
      </p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-100">
        A €5 opening-round brief across five leagues
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        After all five opening rounds finish, the one-off brief turns the public results into a
        written scorecard: model moves, rule-selected consensus calls, a lock/hash audit, failures
        and source links. The complete free sample shows the same format on the World Cup round of
        16. No subscription.
      </p>
      <Link
        href="/briefs/opening-round-2026/"
        className="mt-4 inline-flex text-sm font-semibold text-sky-300 hover:underline"
      >
        See the free sample and €5 offer →
      </Link>
    </section>
  );
}
