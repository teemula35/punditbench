import React from "react";
import type { Metadata } from "next";
import { renderMarkdownFile } from "../../../lib/markdown";
import { CheckoutCta, type OpeningRoundOfferInput } from "./checkout-cta";

export const metadata: Metadata = {
  title: "Five-league opening-round brief and free sample",
  description:
    "A complete free sample of PunditBench's evidence-first football analysis, plus the €5 five-league opening-round brief.",
  alternates: { canonical: "/briefs/opening-round-2026/" },
  openGraph: {
    title: "Five-league opening-round brief and free sample | PunditBench",
    description:
      "Read the complete free sample before deciding whether to buy the one-off €5 opening-round brief.",
    url: "/briefs/opening-round-2026/",
  },
  twitter: {
    card: "summary",
    title: "40 models, 304 picks, and one exact score",
    description:
      "Read PunditBench's complete World Cup round-of-16 audit and the one-off €5 five-league offer.",
  },
};

function offerFromBuildEnvironment(): Partial<OpeningRoundOfferInput> {
  return {
    checkoutUrl: process.env.PB_BRIEF_CHECKOUT_URL,
    sellerName: process.env.PB_BRIEF_SELLER_NAME,
    sellerAddress: process.env.PB_BRIEF_SELLER_ADDRESS,
    supportEmail: process.env.PB_BRIEF_SUPPORT_EMAIL,
    vatNotice: process.env.PB_BRIEF_VAT_NOTICE,
    deliveryMethod: process.env.PB_BRIEF_DELIVERY_METHOD,
    termsUrl: process.env.PB_BRIEF_TERMS_URL,
    privacyUrl: process.env.PB_BRIEF_PRIVACY_URL,
    refundsUrl: process.env.PB_BRIEF_REFUNDS_URL,
  };
}

export default function OpeningRoundBriefPage() {
  const sample = renderMarkdownFile("content/briefs/opening-round-2026-sample.md");

  return (
    <div className="space-y-10">
      <header className="mb-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Free sample + one-off brief
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          Five-league opening-round brief
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          A compact review of the first round in the Premier League, La Liga, Serie A, Ligue 1 and
          Bundesliga, built from PunditBench&apos;s public pre-registered picks and recorded results.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
          <h2 className="text-lg font-semibold text-zinc-100">What the paid brief contains</h2>
          <p className="text-sm font-semibold text-emerald-400">€5 once. No subscription.</p>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Delivery by 3 September 2026 at 23:59 UTC, using the owner-approved method displayed when
          checkout opens. Read the complete free sample below before deciding whether to buy.
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
          The predictions, scores, raw records and methodology remain free. Payment buys only the
          written synthesis after results are public. It does not buy early picks, private picks,
          odds, betting tips, model inclusion, rank changes or influence over the record.
        </p>
        <a
          href="#free-sample"
          className="mt-4 inline-flex text-sm font-semibold text-emerald-400 hover:underline"
        >
          Read the complete free sample ↓
        </a>
      </section>

      <CheckoutCta offer={offerFromBuildEnvironment()} />

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
