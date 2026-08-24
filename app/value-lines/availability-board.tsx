import type {
  ValueLineAvailability,
  ValueLineAvailabilityState,
} from "@/lib/value-line-product";

const STATE_STYLES: Record<ValueLineAvailabilityState, string> = {
  eligible: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  "awaiting-lock": "border-sky-400/30 bg-sky-400/10 text-sky-300",
  unavailable: "border-zinc-700 bg-zinc-800 text-zinc-300",
  postponed: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  expired: "border-zinc-700 bg-zinc-900 text-zinc-500",
};

const STATE_LABELS: Record<ValueLineAvailabilityState, string> = {
  eligible: "Eligible",
  "awaiting-lock": "Awaiting lock",
  unavailable: "Unavailable",
  postponed: "Postponed",
  expired: "Expired",
};

export function AvailabilityBoard({
  rows,
  asOf,
}: {
  rows: ValueLineAvailability[];
  asOf: string;
}) {
  return (
    <section aria-labelledby="availability-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Checked-in schedule
          </p>
          <h2 id="availability-title" className="mt-2 text-2xl font-bold tracking-tight text-zinc-50">
            What is coming next
          </h2>
        </div>
        <p className="text-xs text-zinc-500">Status at static build · {asOf}</p>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
        This is the next scheduled fixture in each covered league, read from PunditBench&apos;s
        public record. An issue includes every future fixture with a valid pre-kickoff lock and at
        least 20 votes—not just the five shown here.
      </p>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
          No upcoming fixtures are available in the checked-in schedule.
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 lg:grid-cols-5" aria-label="Next fixture by covered league">
          {rows.map((row) => (
            <li key={row.competitionId} className="rounded-xl border border-zinc-800 bg-zinc-900/55 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {row.league}
                </p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATE_STYLES[row.state]}`}
                >
                  {STATE_LABELS[row.state]}
                </span>
              </div>
              <p className="mt-4 min-h-10 text-sm font-semibold leading-snug text-zinc-100">
                {row.fixture ?? "No future fixture"}
              </p>
              <p className="mt-2 text-xs text-zinc-500">{row.kickoff ?? "Schedule exhausted"}</p>
              <p className="mt-3 text-xs leading-relaxed text-zinc-400">{row.status}</p>
              {row.sourceHref && (
                <a
                  href={row.sourceHref}
                  className="mt-4 inline-flex text-xs font-semibold text-emerald-300 underline-offset-4 hover:underline"
                >
                  Public source
                  <span className="sr-only"> for {row.fixture}</span>
                  <span aria-hidden="true"> ↗</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
        <p className="rounded-lg border border-zinc-800 px-3 py-2">
          <strong className="text-zinc-300">Unavailable</strong> — fewer than 20 valid votes or a
          record excluded from the locked set.
        </p>
        <p className="rounded-lg border border-zinc-800 px-3 py-2">
          <strong className="text-amber-200">Postponed</strong> — a changed or unverified kickoff is
          withheld until it is safe to issue.
        </p>
        <p className="rounded-lg border border-zinc-800 px-3 py-2">
          <strong className="text-zinc-300">Expired</strong> — kickoff has passed; the card remains
          an immutable historical record.
        </p>
      </div>
    </section>
  );
}
