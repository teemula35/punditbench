import Link from "next/link";
import { championBoard, loadSiteData } from "@/lib/aggregate";
import { loadTeams } from "@/lib/data";
import { fmtKickoffUtc } from "@/lib/format";
import { TAGLINE } from "@/lib/site";
import { TD_CLS, TH_CLS, TeamLabel, TierChip } from "./ui";

export default function LeaderboardPage() {
  const data = loadSiteData();
  const teams = loadTeams();
  const champions = championBoard(data);
  const pendingBrackets = data.leaderboard.filter((e) => !e.championPick).length;

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

      {/* Champion board */}
      <section>
        <h2 className="mb-1 text-lg font-semibold text-zinc-100">Champion board</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Every model simulated its own tournament to the end — these are their champions.
        </p>
        <div className="flex flex-wrap gap-3">
          {champions.map((c) => (
            <div
              key={c.team}
              className="max-w-xs rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3"
            >
              <p className="text-sm font-semibold text-zinc-100">
                <TeamLabel teams={teams} name={c.team} />{" "}
                <span className="text-emerald-400">×{c.models.length}</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {c.models.map((m, i) => (
                  <span key={m.slug}>
                    {i > 0 && <span className="text-zinc-700"> · </span>}
                    <Link href={`/models/${m.slug}/`} className="hover:text-emerald-400">
                      {m.label}
                    </Link>
                  </span>
                ))}
              </p>
            </div>
          ))}
          {pendingBrackets > 0 && (
            <div className="flex max-w-xs items-center rounded-lg border border-dashed border-zinc-800 px-4 py-3">
              <p className="text-xs italic text-zinc-500">
                {pendingBrackets} bracket simulation{pendingBrackets === 1 ? "" : "s"} still being
                collected
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Leaderboard */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">Leaderboard</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/60">
              <tr>
                <th className={TH_CLS}>#</th>
                <th className={TH_CLS}>Model</th>
                <th className={`${TH_CLS} text-right`}>Total</th>
                <th className={`${TH_CLS} text-right`}>Group pts</th>
                <th className={`${TH_CLS} text-right`}>Bracket pts</th>
                <th className={`${TH_CLS} text-right`}>Exact</th>
                <th className={TH_CLS}>Champion pick</th>
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
                    {e.totalPoints}
                  </td>
                  <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>
                    {e.totals.points}
                  </td>
                  <td
                    className={`${TD_CLS} text-right tabular-nums text-zinc-300`}
                    title={`advancement ${e.bracket.advancement} · matchups ${e.bracket.matchupHits} · matched scorelines ${e.bracket.matchupPoints}`}
                  >
                    {e.bracket.total}
                  </td>
                  <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>
                    {e.exactCount}
                  </td>
                  <td className={`${TD_CLS} text-zinc-200`}>
                    {e.championPick ? (
                      <TeamLabel teams={teams} name={e.championPick} />
                    ) : (
                      <span className="text-xs italic text-zinc-500">
                        {e.hasPredictions ? "no valid bracket" : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          Total = group match points (exact 3 · goal difference 2 · outcome 1) + bracket points:
          advancement for every real team a model had reaching each stage (R32 1 · R16 2 · QF 3 ·
          SF 5 · final 8 · champion 13), +1 per simulated pairing that actually occurs, and matched
          pairings&apos; scorelines scored like normal matches. Bracket points pay out once the real
          knockout bracket forms. Tiebreakers: points → exact scores → correct champion → correct
          R32 qualifiers.
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
          Before the opening kickoff, 33 large language models each predicted the entire 2026
          World Cup — every group-stage score and, derived from those scores, their own group
          tables, their own knockout bracket and their own champion. Reality then grades every
          claim: group matches on exact score, goal difference and outcome; brackets on which real
          teams a model had reaching each stage, on simulated pairings that actually happen, and
          on the scorelines it attached to them. Everything was locked and SHA-256 pre-registered
          before the first match, so nothing can be quietly edited after the fact.
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
