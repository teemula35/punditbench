import Link from "next/link";
import { loadSiteData } from "@/lib/aggregate";
import { loadTeams } from "@/lib/data";
import { fmtKickoffUtc } from "@/lib/format";
import { TAGLINE } from "@/lib/site";
import { TD_CLS, TH_CLS, TeamLabel, TierChip } from "./ui";

export default function LeaderboardPage() {
  const data = loadSiteData();
  const teams = loadTeams();

  const upcoming = [...data.fixtures.values()]
    .filter((f) => !data.results.has(f.match))
    .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.match - b.match)
    .slice(0, 8);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section>
        <h1 className="max-w-3xl text-2xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          {TAGLINE}
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          Tournament progress:{" "}
          <span className="font-semibold tabular-nums text-emerald-400">
            {data.playedCount} of {data.totalFixtures}
          </span>{" "}
          matches played
        </p>
      </section>

      {/* Leaderboard */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">Leaderboard</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/60">
              <tr>
                <th className={TH_CLS}>#</th>
                <th className={TH_CLS}>Model</th>
                <th className={`${TH_CLS} text-right`}>Points</th>
                <th className={`${TH_CLS} text-right`}>Exact</th>
                <th className={`${TH_CLS} text-right`}>GD</th>
                <th className={`${TH_CLS} text-right`}>Outcome</th>
                <th className={`${TH_CLS} text-right`}>Adv</th>
                <th className={`${TH_CLS} text-right`}>Scored</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {data.leaderboard.map((e) => (
                <tr key={e.slug} className="hover:bg-zinc-900/40">
                  <td className={`${TD_CLS} w-10 tabular-nums text-zinc-500`}>{e.rank}</td>
                  <td className={TD_CLS}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={`/models/${e.slug}/`}
                        className="font-medium text-zinc-100 hover:text-emerald-400"
                      >
                        {e.model.label}
                      </Link>
                      <span className="text-xs text-zinc-500">{e.model.vendor}</span>
                      <TierChip tier={e.model.tier} />
                      {!e.hasPredictions && (
                        <span className="text-xs italic text-zinc-500">predictions pending</span>
                      )}
                    </div>
                  </td>
                  <td className={`${TD_CLS} text-right text-lg font-bold tabular-nums text-emerald-400`}>
                    {e.totals.points}
                  </td>
                  <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>{e.totals.exact}</td>
                  <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>{e.totals.gd}</td>
                  <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>
                    {e.totals.outcome}
                  </td>
                  <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>
                    {e.totals.advances}
                  </td>
                  <td className={`${TD_CLS} text-right tabular-nums text-zinc-500`}>
                    {e.totals.scoredMatches}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          Exact score 3 pts · correct goal difference 2 · correct outcome 1 · +1 for the advancing
          team in knockouts. Tiebreakers: points → exacts → matches with points → advance hits.
        </p>
      </section>

      {/* Next matches */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Next matches</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {upcoming.map((f) => (
              <Link
                key={f.match}
                href={`/matches/${f.match}/`}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-emerald-400/50"
              >
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Match {f.match}
                  {f.group ? ` · Group ${f.group}` : ""}
                </p>
                <p className="mt-2 text-sm font-medium text-zinc-100">
                  <TeamLabel teams={teams} name={f.home} />
                  <span className="mx-1.5 text-zinc-600">vs</span>
                  <TeamLabel teams={teams} name={f.away} />
                </p>
                <p className="mt-2 text-xs tabular-nums text-zinc-500">
                  {fmtKickoffUtc(f.kickoff_utc)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Explainer */}
      <section className="max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-base font-semibold text-zinc-100">What is this?</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          PunditBench asks 18 large language models to predict the result of every 2026 World Cup
          match, using identical prompts and nothing but their training knowledge. Predictions are
          locked and hash-pre-registered before kickoff, then scored against the real results.
          The leaderboard above updates after every match — a running answer to whether AI can
          call the beautiful game.
        </p>
        <p className="mt-3 text-sm">
          <Link
            href="/methodology/"
            className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-400"
          >
            Read the full methodology →
          </Link>
        </p>
      </section>
    </div>
  );
}
