import React from "react";
import type { Metadata } from "next";
import { renderMarkdownFile } from "../../../lib/markdown";

export const metadata: Metadata = {
  title: "Historical PunditBench analysis sample",
  description:
    "A complete historical sample of PunditBench's evidence-first football analysis.",
  alternates: { canonical: "/briefs/opening-round-2026/" },
  openGraph: {
    title: "Historical analysis sample | PunditBench",
    description:
      "Read a complete historical PunditBench analysis sample.",
    url: "/briefs/opening-round-2026/",
  },
  twitter: {
    card: "summary",
    title: "40 models, 304 picks, and one exact score",
    description:
      "Read PunditBench's complete World Cup round-of-16 audit.",
  },
};

export default function OpeningRoundBriefPage() {
  const sample = renderMarkdownFile("content/briefs/opening-round-2026-sample.md");

  return (
    <div className="space-y-10">
      <header className="mb-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Historical format sample
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          PunditBench analysis sample
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          This archived page preserves the complete free World Cup round-of-16 sample that showed
          how PunditBench documented pre-registered picks and recorded results.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
          <h2 className="text-lg font-semibold text-zinc-100">About this archive</h2>
          <p className="text-sm font-semibold text-emerald-400">Free historical evidence</p>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
          The former opening-round brief offer is closed. The sample remains public so its claims,
          source links and audit format can still be inspected.
        </p>
        <ul className="mt-4 grid list-disc gap-2 pl-5 text-sm leading-relaxed text-zinc-300 sm:grid-cols-2">
          <li>A five-league scorecard with valid and missing-pick denominators.</li>
          <li>Where every model landed after the opening round, with source links.</li>
          <li>Five highest-consensus calls, included whether right or wrong.</li>
          <li>The relevant lock, commit, tag and hash evidence.</li>
          <li>Provider, parser and data-quality issues, including recorded absences.</li>
          <li>Underlying evidence links and a dated correction log.</li>
        </ul>
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-zinc-500">
          The predictions, scores, raw records and methodology remain free. This archived page has
          no purchase or checkout control.
        </p>
        <a
          href="#free-sample"
          className="mt-4 inline-flex text-sm font-semibold text-emerald-400 hover:underline"
        >
          Read the complete free sample ↓
        </a>
      </section>

      <p className="rounded-lg border border-zinc-800 px-4 py-3 text-xs leading-relaxed text-zinc-500">
        For adults (18+). Informational editorial content only. Not betting advice. Do not use it
        to gamble.
      </p>

      <section id="free-sample" aria-labelledby="free-sample-title" className="scroll-mt-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Complete free sample
        </p>
        <h2 id="free-sample-title" className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">
          World Cup 2026 round of 16
        </h2>
        <div className="prose mt-6" dangerouslySetInnerHTML={{ __html: sample }} />
      </section>
    </div>
  );
}
