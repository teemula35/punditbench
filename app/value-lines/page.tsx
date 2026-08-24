import type { Metadata } from "next";
import {
  VALUE_LINE_LEAGUES,
  VALUE_LINE_ELIGIBILITY_BOUNDARY,
  VALUE_LINE_MINIMUM_EDGE,
  VALUE_LINE_MINIMUM_VOTES,
  VALUE_LINE_PRICE_EUR,
  loadValueLineAvailability,
  valueLineCheckoutFromEnvironment,
} from "@/lib/value-line-product";
import { AvailabilityBoard } from "./availability-board";
import { ValueLineCheckoutCta } from "./checkout-cta";
import { HistoricalForecastCard } from "./forecast-card";
import ValueLinePolicyLinks from "./policy-links";

export const metadata: Metadata = {
  title: "Value lines across five European leagues",
  description:
    "Compare calibrated PunditBench 1/X/2 probabilities, fair odds and 5% value thresholds for eligible fixtures across five European leagues.",
  alternates: { canonical: "/value-lines/" },
  openGraph: {
    title: "PunditBench Value Lines · every eligible fixture",
    description: "Three transparent 1/X/2 prices per eligible fixture, delivered after the public prediction lock.",
    url: "/value-lines/",
  },
};

const STEPS = [
  {
    number: "01",
    title: "Models vote before kickoff",
    copy: `A fixture enters the card only after its public PunditBench round is locked and at least ${VALUE_LINE_MINIMUM_VOTES} valid model picks exist.`,
  },
  {
    number: "02",
    title: "Votes become calibrated probabilities",
    copy: "A time-safe calibration converts the raw 1/X/2 split into probabilities, with the source lock and method version recorded on the issue.",
  },
  {
    number: "03",
    title: "One threshold for any bookmaker",
    copy: `Bet from is the first two-decimal price that clears a ${(VALUE_LINE_MINIMUM_EDGE * 100).toFixed(0)}% model edge. Compare it with decimal odds wherever you already choose to look.`,
  },
] as const;

export default function ValueLinesPage() {
  const builtAt = new Date();
  const availability = loadValueLineAvailability(builtAt);

  return (
    <div className="space-y-20 pb-10">
      <section className="relative isolate overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/45 px-5 py-10 shadow-2xl shadow-black/30 sm:px-10 sm:py-16 lg:px-14">
        <div
          aria-hidden="true"
          className="absolute -right-28 -top-32 -z-10 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 left-1/4 -z-10 h-72 w-72 rounded-full bg-sky-400/[0.06] blur-3xl"
        />
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-300">
              Value Lines
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-950/50 px-3 py-1 text-zinc-300">
              Not betting advice.
            </span>
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-[-0.04em] text-zinc-50 sm:text-6xl">
            Know the price before you choose the book.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
            Every eligible fixture gets three transparent 1/X/2 thresholds: the raw model vote,
            calibrated probability, model fair odds and the decimal price that reaches a 5% model
            edge. No bookmaker account or integration required.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#checkout"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-400 px-5 py-3 text-sm font-bold text-zinc-950 transition-colors hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              See subscription access
            </a>
            <p className="text-sm text-zinc-400">
              <span className="font-bold text-zinc-100">€{VALUE_LINE_PRICE_EUR}/month</span> ·
              recurring · cancel any time
            </p>
          </div>
          <p className="mt-5 max-w-2xl text-xs leading-relaxed text-zinc-500">
            {VALUE_LINE_ELIGIBILITY_BOUNDARY} Join at least 60 minutes before an issue&apos;s first
            kickoff to receive that issue; later subscriptions start with the next one.
          </p>
        </div>

        <ul className="mt-10 flex flex-wrap gap-2" aria-label="Covered leagues">
          {VALUE_LINE_LEAGUES.map((league) => (
            <li
              key={league.id}
              className="rounded-full border border-zinc-700/80 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-300"
            >
              {league.name}
            </li>
          ))}
        </ul>
      </section>

      <AvailabilityBoard rows={availability} asOf={builtAt.toISOString().replace(/\.\d{3}Z$/, "Z")} />

      <section aria-labelledby="how-it-works-title">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          From public lock to private issue
        </p>
        <h2 id="how-it-works-title" className="mt-2 text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          A threshold, not a bookmaker pick
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <article key={step.number} className="rounded-xl border border-zinc-800 bg-zinc-900/45 p-5">
              <p className="font-mono text-xs text-emerald-400">{step.number}</p>
              <h3 className="mt-4 font-semibold text-zinc-100">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.copy}</p>
            </article>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 text-sm leading-relaxed text-zinc-400">
          <p>
            Take the threshold to any bookmaker you already choose. At or above <strong className="text-zinc-100">Bet from</strong>,
            the quoted price clears the model&apos;s 5% edge rule; one cent below may not. PunditBench
            does not scrape bookmaker odds, connect accounts, place bets, recommend stakes or earn
            affiliate commissions.
          </p>
          <p className="mt-3 font-semibold text-zinc-200">Not betting advice.</p>
        </div>
      </section>

      <section aria-labelledby="sample-title">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              See every number first
            </p>
            <h2 id="sample-title" className="mt-2 text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
              A complete historical card sample
            </h2>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-zinc-500">
            This synthetic archived example shows the exact customer format without presenting a
            current fixture or live opportunity.
          </p>
        </div>
        <HistoricalForecastCard />
        <div className="mt-5 grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/35 p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <h3 className="font-semibold text-zinc-100">The calculation</h3>
            <p className="mt-2 font-mono text-xs leading-relaxed text-emerald-200">
              fair odds = 1 ÷ calibrated probability
              <br />
              bet from = round up((1 + 0.05) ÷ probability, 0.01)
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100">Why the home line is 2.02</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              At 52%, decimal odds 2.02 imply a 5.04% model edge. At 2.01, the model edge is 4.52%,
              so it does not clear the rule. Thresholds are comparison points, not guarantees.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="membership-title" className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            One simple membership
          </p>
          <h2 id="membership-title" className="mt-2 text-3xl font-black tracking-tight text-zinc-50">
            Every eligible card. €9 monthly.
          </h2>
          <ul className="mt-6 space-y-3 text-sm leading-relaxed text-zinc-300">
            {[
              "All three 1/X/2 outcomes for every eligible future fixture.",
              "Premier League, La Liga, Serie A, Ligue 1 and Bundesliga only.",
              "Delivery after the immutable public lock by email and subscriber dashboard.",
              "Each issue delivered once, with source and calibration provenance.",
              "Cancel any time; access continues until the paid period ends.",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="mt-0.5 text-emerald-400">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs leading-relaxed text-zinc-500">
            If a lock is invalid, a source hash does not match, a fixture is postponed or fewer
            than 20 valid votes remain, no card is issued for that fixture.
          </p>
        </div>

        <div id="checkout" className="scroll-mt-6">
          <ValueLineCheckoutCta offer={valueLineCheckoutFromEnvironment()} />
          <ValueLinePolicyLinks />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 text-xs leading-relaxed text-zinc-500 sm:p-6">
        <p className="font-semibold text-zinc-200">Not betting advice.</p>
        <p className="mt-2">
          Probabilities and thresholds are model outputs for statistical and entertainment use.
          They do not promise profit, tell you what to stake or account for your finances. Gambling
          involves risk and you can lose money. {VALUE_LINE_ELIGIBILITY_BOUNDARY}
        </p>
      </section>
    </div>
  );
}
