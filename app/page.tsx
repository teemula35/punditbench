import Link from "next/link";
import {
  championBoard,
  consensus,
  liveConsensus,
  liveOutcomeSplit,
  loadSiteData,
  outcomeSplit,
  type OutcomeSplit,
} from "@/lib/aggregate";
import { loadTeams } from "@/lib/data";
import { fmtKickoffUtc } from "@/lib/format";
import { teamFlag } from "@/lib/prompt";
import { reportCards } from "@/lib/report-card";
import { TAGLINE } from "@/lib/site";
import { NotifyForm } from "./notify";
import { TodayMatches, type TodayCard } from "./today-matches";
import { TD_CLS, TH_CLS, TeamLabel, TierChip } from "./ui";
import type { Fixture, Team } from "@/lib/types";
import { roundLabel } from "@/lib/types";

/** One compact stat block for the hero scope strip. */
function ScopeStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
      <span className="text-base font-bold tabular-nums text-emerald-400">{value}</span>
      <span>{label}</span>
    </div>
  );
}

/** A named result in the verdict strip — label above, who/what below. */
function VerdictStat({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  href?: string;
}) {
  return (
    <div className="min-w-[10rem] flex-1 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-100">
        {href ? (
          <Link href={href} className="hover:text-emerald-400">
            {value}
          </Link>
        ) : (
          value
        )}
      </p>
      {note && <p className="mt-0.5 text-xs text-zinc-500">{note}</p>}
    </div>
  );
}

/** "31/40 back Mexico" / "18/40 call a draw" — the most-backed outcome. */
function SplitLine({
  split,
  fixture,
  teams,
}: {
  split: OutcomeSplit;
  fixture: Fixture;
  teams: Team[];
}) {
  const { home, draw, away, outOf } = split;
  let n: number;
  let backed: React.ReactNode;
  if (home >= away && home >= draw) {
    n = home;
    backed = (
      <>
        back <TeamLabel teams={teams} name={fixture.home} />
      </>
    );
  } else if (away >= draw) {
    n = away;
    backed = (
      <>
        back <TeamLabel teams={teams} name={fixture.away} />
      </>
    );
  } else {
    n = draw;
    backed = "call a draw";
  }
  return (
    <p className="text-xs text-zinc-500">
      <span className="tabular-nums">
        {n}/{outOf}
      </span>{" "}
      {backed}
    </p>
  );
}

export default function LeaderboardPage() {
  const data = loadSiteData();
  const teams = loadTeams();
  const champions = championBoard(data);
  const pendingBrackets = data.leaderboard.filter((e) => !e.championPick).length;
  const groupCount = [...data.fixtures.values()].filter((f) => f.stage === "group").length;
  // A model page that demonstrably contains a complete predicted tournament.
  const exampleBracket = data.leaderboard.find((e) => e.bracketComplete && e.championPick);
  // Before any match is played (and any real knockout fixture exists) every
  // model is tied at zero — a rank column full of "#1" is technically true
  // but meaningless, so show a dash until there is something to rank on.
  const rankable =
    data.playedCount > 0 || [...data.fixtures.values()].some((f) => f.stage !== "group");

  const upcoming = [...data.fixtures.values()]
    .filter((f) => !data.results.has(f.match))
    .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.match - b.match)
    .slice(0, 8);

  // Once the tournament is over the front page leads with the verdict rather
  // than the pre-kickoff pitch. Everything below is derived from the same
  // snapshot the leaderboard uses, so a corrected result reshapes the hero
  // instead of stranding hand-written copy; if the final is ever missing or
  // unplayed the original tagline hero renders instead.
  const finalFixture = [...data.fixtures.values()].find((f) => f.stage === "final");
  const finalResult = finalFixture ? data.results.get(finalFixture.match) : undefined;
  const champion = finalResult?.status === "final" ? finalResult.advances : undefined;
  const calledIt = champion
    ? data.leaderboard.filter((e) => e.championPick === champion).length
    : 0;
  const cards = reportCards(data);
  const lockedWinner = data.leaderboard.find((e) => e.rank === 1);
  const liveField = [...cards.values()].filter((c) => c.liveRank !== undefined);
  const liveWinner = liveField.find((c) => c.liveRank === 1);
  const lockedWinnerLive = lockedWinner ? cards.get(lockedWinner.slug) : undefined;
  // The headline finding only holds if the two tracks actually disagree.
  const tracksDisagree =
    lockedWinner !== undefined &&
    liveWinner !== undefined &&
    lockedWinnerLive?.liveRank !== undefined &&
    liveWinner.slug !== lockedWinner.slug;

  // Every fixture as a lightweight pre-rendered card; "today" is resolved in
  // the visitor's browser (see today-matches.tsx) so the section rolls over
  // at midnight without a redeploy.
  const todayCards: TodayCard[] = [...data.fixtures.values()]
    .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.match - b.match)
    .map((f) => {
      const result = data.results.get(f.match);
      const played =
        result?.status === "final" &&
        result.home_goals !== undefined &&
        result.away_goals !== undefined;
      const cons = played ? undefined : f.stage === "group" ? consensus(data, f) : liveConsensus(data, f);
      const split = played
        ? undefined
        : f.stage === "group"
          ? outcomeSplit(data, f)
          : liveOutcomeSplit(data, f);
      let splitLine: string | undefined;
      if (split) {
        const { home, draw, away, outOf } = split;
        splitLine =
          home >= away && home >= draw
            ? `${home}/${outOf} back ${teamFlag(teams, f.home)} ${f.home}`
            : away >= draw
              ? `${away}/${outOf} back ${teamFlag(teams, f.away)} ${f.away}`
              : `${draw}/${outOf} call a draw`;
      }
      return {
        match: f.match,
        kickoff_utc: f.kickoff_utc,
        stageLabel: f.stage === "group" ? `Group ${f.group}` : roundLabel(f.stage),
        homeLabel: `${teamFlag(teams, f.home)} ${f.home}`,
        awayLabel: `${teamFlag(teams, f.away)} ${f.away}`,
        kickoffLabel: fmtKickoffUtc(f.kickoff_utc),
        scoreLabel: played ? `${result.home_goals}–${result.away_goals}` : undefined,
        consensusLine: cons
          ? `Consensus ${cons.home}–${cons.away} · ${cons.count} of ${cons.outOf}`
          : undefined,
        splitLine,
      };
    });

  return (
    <div className="space-y-12">
      {/* Hero — the verdict once the tournament is complete, the pitch before */}
      {champion ? (
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            2026 World Cup · Complete
          </p>
          <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            <TeamLabel teams={teams} name={champion} /> won the World Cup. {calledIt} of{" "}
            {data.leaderboard.length} models called it.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Every model predicted all {data.totalFixtures} matches before the opening kickoff —
            locked and SHA-256 pre-registered — and then predicted each knockout round again as
            the real bracket emerged. Two tracks, two different winners.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <VerdictStat
              label="Champion"
              value={<TeamLabel teams={teams} name={champion} />}
              note={`Picked by ${calledIt} of ${data.leaderboard.length} models`}
            />
            {lockedWinner && (
              <VerdictStat
                label="Locked benchmark"
                value={lockedWinner.model.label}
                note={`${lockedWinner.totalPoints} pts · picked ${lockedWinner.championPick ?? "no champion"}`}
                href={`/models/${lockedWinner.slug}/`}
              />
            )}
            {liveWinner && (
              <VerdictStat
                label="Round by round"
                value={liveWinner.label}
                note={`${liveWinner.livePoints} pts · #${liveWinner.lockedRank} on the locked board`}
                href={`/models/${liveWinner.slug}/`}
              />
            )}
          </div>

          {tracksDisagree && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-300">
              The two boards disagree.{" "}
              <Link
                href={`/models/${lockedWinner.slug}/`}
                className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-400"
              >
                {lockedWinner.model.label}
              </Link>{" "}
              won the locked benchmark on {lockedWinner.totalPoints} points, then finished{" "}
              <span className="tabular-nums">#{lockedWinnerLive.liveRank}</span> of{" "}
              <span className="tabular-nums">{liveField.length}</span> once it had to call each
              round as it came — the track{" "}
              <Link
                href={`/models/${liveWinner.slug}/`}
                className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-400"
              >
                {liveWinner.label}
              </Link>{" "}
              won.
            </p>
          )}
        </section>
      ) : (
        <section>
          <h1 className="max-w-3xl text-2xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            {TAGLINE}
          </h1>
          {/* Scope strip — the full claim in one glance: every model, every match. */}
          <div className="mt-5 flex flex-wrap gap-2">
            <ScopeStat value={String(data.leaderboard.length)} label="models" />
            <ScopeStat value={String(data.totalFixtures)} label="matches each" />
            <ScopeStat value={String(groupCount)} label="group games + full knockout bracket" />
            <div className="flex items-center rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
              locked &amp; SHA-256 pre-registered before kickoff
            </div>
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            Tournament progress:{" "}
            <span className="font-semibold tabular-nums text-emerald-400">
              {data.playedCount} of {data.totalFixtures}
            </span>{" "}
            matches played
          </p>
        </section>
      )}

      {/* League bridge — the front page's job between the final and August is
          converting an arriving visitor into a returning one, so this sits
          above the leaderboard rather than at the foot of the page. */}
      <section className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Next · Season 2026-27
          </p>
          <Link href="/leagues/" className="text-sm text-emerald-400 hover:underline">
            Explore the leagues →
          </Link>
        </div>
        <h2 className="mt-2 text-lg font-semibold text-zinc-100">
          The same benchmark moves to the European leagues
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Premier League, La Liga, Serie A and Ligue 1 from August 16, with the Bundesliga and
          Champions League following. Every matchday, all {data.leaderboard.length} models predict
          every scoreline — this time shown the current table and each team&apos;s recent form —
          locked and hashed about 36 hours before the first kickoff.
        </p>
        <div className="mt-4">
          <NotifyForm />
        </div>
      </section>

      {/* Today's matches — client-rendered, follows the visitor's local date */}
      <TodayMatches cards={todayCards} />

      {/* Leaderboard */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">Leaderboard</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          {/* <sm shows #, Model, Total and Champion pick; the component columns
              reappear from sm up (hidden sm:table-cell on matching th + td). */}
          <table className="w-full text-sm sm:min-w-[760px]">
            <thead className="border-b border-zinc-800 bg-zinc-900/60">
              <tr>
                <th className={TH_CLS}>#</th>
                <th className={TH_CLS}>Model</th>
                <th className={`${TH_CLS} text-right`}>Total</th>
                <th className={`${TH_CLS} hidden text-right sm:table-cell`}>Group pts</th>
                <th className={`${TH_CLS} hidden text-right sm:table-cell`}>Bracket pts</th>
                <th className={`${TH_CLS} hidden text-right sm:table-cell`}>Exact</th>
                <th className={TH_CLS}>Champion pick</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {data.leaderboard.map((e) => (
                <tr key={e.slug} className="hover:bg-zinc-900/40">
                  <td className={`${TD_CLS} w-10 tabular-nums text-zinc-500`}>
                    {rankable ? e.rank : "—"}
                  </td>
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
                        <span className="text-xs italic text-zinc-500">no valid predictions</span>
                      )}
                    </div>
                  </td>
                  <td className={`${TD_CLS} text-right text-lg font-bold tabular-nums text-emerald-400`}>
                    {e.totalPoints}
                  </td>
                  <td className={`${TD_CLS} hidden text-right tabular-nums text-zinc-300 sm:table-cell`}>
                    {e.totals.points}
                  </td>
                  <td
                    className={`${TD_CLS} hidden text-right tabular-nums text-zinc-300 sm:table-cell`}
                    title={`advancement ${e.bracket.advancement} · matchups ${e.bracket.matchupHits} · matched scorelines ${e.bracket.matchupPoints}`}
                  >
                    {e.bracket.total}
                  </td>
                  <td className={`${TD_CLS} hidden text-right tabular-nums text-zinc-300 sm:table-cell`}>
                    {e.exactCount}
                  </td>
                  <td className={`${TD_CLS} text-zinc-200`}>
                    {e.championPick ? (
                      <div className="max-w-28 truncate sm:max-w-none" title={e.championPick}>
                        <TeamLabel teams={teams} name={e.championPick} />
                      </div>
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
          <h2 className="mb-1 text-lg font-semibold text-zinc-100">Next matches</h2>
          <p className="mb-4 text-sm text-zinc-400">
            Open a match to compare every model&apos;s prediction — group scorelines locked
            pre-tournament, knockout ties predicted round by round.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {upcoming.map((f) => {
              // Direct predictions only exist for group fixtures; knockout
              // fixtures are covered via each model's simulated bracket.
              const cons = f.stage === "group" ? consensus(data, f) : liveConsensus(data, f);
              const split = f.stage === "group" ? outcomeSplit(data, f) : liveOutcomeSplit(data, f);
              return (
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
                  {cons && (
                    <div className="mt-2 space-y-0.5 border-t border-zinc-800/70 pt-2">
                      <p className="text-xs text-zinc-500">
                        Consensus{" "}
                        <span className="font-semibold tabular-nums text-zinc-100">
                          {cons.home}–{cons.away}
                        </span>
                        <span className="text-zinc-600"> · </span>
                        <span className="tabular-nums">
                          {cons.count} of {cons.outOf}
                        </span>
                      </p>
                      {split && <SplitLine split={split} fixture={f} teams={teams} />}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Champion board */}
      <section>
        <h2 className="mb-1 text-lg font-semibold text-zinc-100">…and their champions</h2>
        <p className="mb-4 max-w-2xl text-sm text-zinc-400">
          Champion picks aren&apos;t standalone guesses — each one is simply where that
          model&apos;s complete simulated tournament ends: 72 group scores rolled into group
          tables, then its own bracket from the Round of 32 through the final
          {exampleBracket ? (
            <>
              {" "}
              (see{" "}
              <Link
                href={`/models/${exampleBracket.slug}/`}
                className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-400"
              >
                {exampleBracket.model.label}&apos;s full bracket
              </Link>{" "}
              for an example).
            </>
          ) : (
            "."
          )}
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
                {pendingBrackets} model{pendingBrackets === 1 ? "" : "s"} without a valid bracket —
                couldn&apos;t produce valid knockout predictions within the retry policy (see
                methodology)
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Explainer */}
      <section className="max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-base font-semibold text-zinc-100">What is this?</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Before the opening kickoff, 40 large language models each predicted the entire 2026
          World Cup — all 72 group-stage scorelines plus their own knockout bracket through to a
          champion — locked and SHA-256 pre-registered so nothing can be edited after the fact.
          Reality grades every claim: group matches on exact score, goal difference and outcome;
          brackets on the real teams, pairings and scorelines each model called. Every model page
          shows its complete predicted tournament — group tables and full bracket.
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
