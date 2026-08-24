import { HISTORICAL_VALUE_LINE_SAMPLE } from "@/lib/value-line-product";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function odds(value: number): string {
  return value.toFixed(2);
}

export function HistoricalForecastCard() {
  return (
    <article
      aria-labelledby="historical-card-title"
      className="overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950 shadow-2xl shadow-black/30"
    >
      <header className="border-b border-zinc-800 bg-zinc-900/70 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Historical sample · forecast-card.v1
            </p>
            <h3 id="historical-card-title" className="mt-2 text-xl font-bold text-zinc-50 sm:text-2xl">
              Northbridge FC <span className="font-normal text-zinc-600">vs</span> Southbank FC
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Archived worked example · 18 May 2025 · illustrative inputs
            </p>
          </div>
          <span
            aria-label="Historical sample status: expired"
            className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-300"
          >
            Expired
          </span>
        </div>
        <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs font-semibold text-amber-100">
          Historical demonstration only. Not betting advice.
        </p>
      </header>

      <div
        className="grid gap-px bg-zinc-800 sm:grid-cols-3"
        aria-label="Historical 1 X 2 value-line outcomes"
      >
        {HISTORICAL_VALUE_LINE_SAMPLE.map((item) => (
          <section
            key={item.outcome}
            aria-labelledby={`sample-outcome-${item.outcome}`}
            className="bg-zinc-950 p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h4
                id={`sample-outcome-${item.outcome}`}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-lg font-black text-emerald-300"
              >
                {item.outcome}
              </h4>
              <span className="text-xs font-medium text-zinc-500">{item.label}</span>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-end justify-between gap-3 border-b border-zinc-800 pb-3">
                <dt className="text-zinc-500">Votes / share</dt>
                <dd className="font-semibold tabular-nums text-zinc-100">
                  {item.votes}/{item.outOf} · {percent(item.votes / item.outOf)}
                </dd>
              </div>
              <div className="flex items-end justify-between gap-3 border-b border-zinc-800 pb-3">
                <dt className="text-zinc-500">Calibrated probability</dt>
                <dd className="font-semibold tabular-nums text-zinc-100">
                  {percent(item.probability)}
                </dd>
              </div>
              <div className="flex items-end justify-between gap-3 border-b border-zinc-800 pb-3">
                <dt className="text-zinc-500">Model fair odds</dt>
                <dd className="font-semibold tabular-nums text-zinc-100">{odds(item.fairOdds)}</dd>
              </div>
              <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/[0.07] p-3">
                <dt className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  Bet from
                </dt>
                <dd className="mt-1 text-3xl font-black tabular-nums tracking-tight text-zinc-50">
                  {odds(item.betFrom)}
                </dd>
              </div>
            </dl>
          </section>
        ))}
      </div>

      <footer className="border-t border-zinc-800 bg-zinc-900/40 p-5 text-xs leading-relaxed text-zinc-500 sm:px-7">
        <p>
          Provenance: illustrative historical schema sample · calibration: walk-forward example
          v1 · minimum model edge: 5% · decimal prices rounded upward in 0.01 increments.
        </p>
        <p className="mt-2 font-mono text-[11px] text-zinc-600">
          issue type forecast-card.v1 · sample record expired · no live bookmaker price
        </p>
      </footer>
    </article>
  );
}
