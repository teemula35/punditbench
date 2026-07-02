import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCompetitions } from "@/lib/data";
import { fmtKickoffUtc, fmtShortDateUtc } from "@/lib/format";
import { fixturesByRound, loadLeagueData, nextRound } from "@/lib/league-aggregate";
import { loadSeasonPredictions, scoreSeasonTable } from "@/lib/season-prediction";
import { mdKey, roundLabel } from "@/lib/types";
import { PageTitle, TD_CLS, TH_CLS, TierChip } from "../../ui";

export function generateStaticParams() {
  return loadCompetitions().map((c) => ({ comp: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ comp: string }>;
}): Promise<Metadata> {
  const { comp } = await params;
  const c = loadCompetitions().find((x) => x.id === comp);
  if (!c) return { title: "Competition not found" };
  return {
    title: c.name,
    description: `LLM season leaderboard for the ${c.name}: form-aware picks for every matchday, locked and pre-registered before each round.`,
  };
}

export default async function LeaguePage({ params }: { params: Promise<{ comp: string }> }) {
  const { comp: compId } = await params;
  if (!loadCompetitions().some((c) => c.id === compId)) notFound();
  const data = loadLeagueData(compId);

  const rounds = fixturesByRound(data);
  const next = nextRound(data);
  const nextLock = next ? data.manifest.rounds[mdKey(next.round)] : undefined;
  const nextFirst = next?.fixtures[0];
  const anyScored = data.leaderboard.some((e) => e.totals.scoredMatches > 0);
  const firstFixture = [...data.fixtures.values()].sort(
    (a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.match - b.match,
  )[0];

  return (
    <div className="space-y-10">
      <PageTitle
        kicker={`League benchmark · ${data.comp.season_label}`}
        title={data.comp.name}
        sub={`${data.leaderboard.length} models predict every ${data.comp.short_name} scoreline one matchday at a time — shown the current table and each team's recent form, locked ~36h before each round's first kickoff. Exact score 3 · goal difference 2 · outcome 1.`}
      />

      {data.totalFixtures === 0 ? (
        <div className="max-w-2xl rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-5">
          <p className="text-sm text-zinc-400">
            Fixtures not yet published — the {data.comp.season_label} {data.comp.short_name}{" "}
            schedule isn&apos;t available in the data feeds yet. The competition onboards once it
            is published; Matchday 1 picks will lock ~36h before the opening kickoff.
          </p>
        </div>
      ) : (
        <>
          {/* Next round strip */}
          {next && nextFirst && (
            <section className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  Next round
                </span>
                <span className="font-semibold text-zinc-100">{roundLabel(mdKey(next.round))}</span>
                <span className="tabular-nums text-zinc-400">
                  First kickoff {fmtKickoffUtc(nextFirst.kickoff_utc)}
                </span>
                {nextLock ? (
                  <span className="text-emerald-300">
                    Locked · <span className="tabular-nums">{nextLock.models}</span> models
                    pre-registered
                  </span>
                ) : (
                  <span className="text-zinc-400">
                    Picks lock ~36h before the first kickoff
                  </span>
                )}
                <Link
                  href={`/leagues/${data.comp.id}/matches/${nextFirst.match}/`}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  View the matchday&apos;s first match →
                </Link>
              </div>
            </section>
          )}

          {/* Season leaderboard */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">Season leaderboard</h2>
            {!anyScored && (
              <div className="mb-4 max-w-3xl rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-4">
                <p className="text-sm text-zinc-400">
                  No rounds scored yet — the season starts{" "}
                  {firstFixture ? fmtShortDateUtc(firstFixture.kickoff_utc) : "soon"}. All{" "}
                  {data.leaderboard.length} models&apos; picks lock before every matchday and the
                  board fills in as the rounds are played.
                </p>
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              {/* <sm shows #, Model, Points and Pts/match; the component columns
                  reappear from sm up (hidden sm:table-cell on matching th + td). */}
              <table className="w-full text-sm sm:min-w-[760px]">
                <thead className="border-b border-zinc-800 bg-zinc-900/60">
                  <tr>
                    <th className={TH_CLS}>#</th>
                    <th className={TH_CLS}>Model</th>
                    <th className={`${TH_CLS} text-right`}>Points</th>
                    <th className={`${TH_CLS} hidden text-right sm:table-cell`}>Exact</th>
                    <th className={`${TH_CLS} hidden text-right sm:table-cell`}>GD</th>
                    <th className={`${TH_CLS} hidden text-right sm:table-cell`}>Outcome</th>
                    <th className={`${TH_CLS} hidden text-right sm:table-cell`}>Picks</th>
                    <th className={`${TH_CLS} text-right`}>Pts/match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {data.leaderboard.map((e) => (
                    <tr key={e.slug} className="hover:bg-zinc-900/40">
                      <td className={`${TD_CLS} w-10 tabular-nums text-zinc-500`}>
                        {anyScored ? e.rank : "—"}
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
                        </div>
                      </td>
                      <td
                        className={`${TD_CLS} text-right text-lg font-bold tabular-nums text-emerald-400`}
                      >
                        {e.totals.points}
                      </td>
                      <td className={`${TD_CLS} hidden text-right tabular-nums text-zinc-300 sm:table-cell`}>
                        {e.totals.exact}
                      </td>
                      <td className={`${TD_CLS} hidden text-right tabular-nums text-zinc-300 sm:table-cell`}>
                        {e.totals.gd}
                      </td>
                      <td className={`${TD_CLS} hidden text-right tabular-nums text-zinc-300 sm:table-cell`}>
                        {e.totals.outcome}
                      </td>
                      <td className={`${TD_CLS} hidden text-right tabular-nums text-zinc-300 sm:table-cell`}>
                        {e.picksCount}
                      </td>
                      <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>
                        {e.pointsPerMatch.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              Exact score 3 · goal difference 2 · outcome 1. Pts/match = points per scored match —
              a model is scored on every match of a round it locked picks for, including any it
              failed to predict. Tiebreakers: points → exact scores → matches with points; models
              without any stored picks rank below participants.
            </p>
          </section>

          {/* The real league table — appears once results exist */}
          {data.playedCount > 0 && (
            <section>
              <h2 className="mb-1 text-lg font-semibold text-zinc-100">League table</h2>
              <p className="mb-4 text-sm text-zinc-400">
                The real {data.comp.short_name} table from synced results — what the models are
                trying to out-predict.{" "}
                <span className="tabular-nums">
                  {data.playedCount} of {data.totalFixtures}
                </span>{" "}
                fixtures played.
              </p>
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-sm sm:min-w-[560px]">
                  <thead className="border-b border-zinc-800 bg-zinc-900/60">
                    <tr>
                      <th className={TH_CLS}>#</th>
                      <th className={TH_CLS}>Team</th>
                      <th className={`${TH_CLS} text-right`}>P</th>
                      <th className={`${TH_CLS} text-right`}>W</th>
                      <th className={`${TH_CLS} text-right`}>D</th>
                      <th className={`${TH_CLS} text-right`}>L</th>
                      <th className={`${TH_CLS} hidden text-right sm:table-cell`}>GF</th>
                      <th className={`${TH_CLS} hidden text-right sm:table-cell`}>GA</th>
                      <th className={`${TH_CLS} text-right`}>GD</th>
                      <th className={`${TH_CLS} text-right`}>Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {data.table.map((row, i) => (
                      <tr key={row.team} className="hover:bg-zinc-900/40">
                        <td className={`${TD_CLS} w-10 tabular-nums text-zinc-500`}>{i + 1}</td>
                        <td className={`${TD_CLS} font-medium text-zinc-100`}>{row.team}</td>
                        <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>{row.played}</td>
                        <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>{row.won}</td>
                        <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>{row.drawn}</td>
                        <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>{row.lost}</td>
                        <td className={`${TD_CLS} hidden text-right tabular-nums text-zinc-400 sm:table-cell`}>
                          {row.gf}
                        </td>
                        <td className={`${TD_CLS} hidden text-right tabular-nums text-zinc-400 sm:table-cell`}>
                          {row.ga}
                        </td>
                        <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>{row.gd}</td>
                        <td className={`${TD_CLS} text-right font-bold tabular-nums text-emerald-400`}>
                          {row.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-zinc-600">
                Generic ordering (points → goal difference → goals for); league-specific
                head-to-head rules are not applied.
              </p>
            </section>
          )}

          {/* Pre-season table predictions (locked track), graded live */}
          {(() => {
            const seasonPreds = loadSeasonPredictions(data.comp.id);
            if (seasonPreds.length === 0) return null;
            const modelBySlug = new Map(data.leaderboard.map((e) => [e.slug, e.model]));
            const graded = data.playedCount > 0;
            const actualOrder = data.table.map((r) => r.team);
            const relegationSpots = seasonPreds[0].table.length >= 20 ? 3 : 2;
            const rows = seasonPreds
              .map((p) => ({
                pred: p,
                model: modelBySlug.get(p.slug),
                score: graded ? scoreSeasonTable(p.table, actualOrder) : undefined,
              }))
              .sort((a, b) =>
                graded
                  ? (b.score?.total ?? 0) - (a.score?.total ?? 0) || a.pred.slug.localeCompare(b.pred.slug)
                  : (a.model?.label ?? a.pred.slug).localeCompare(b.model?.label ?? b.pred.slug),
              );
            const championCounts = new Map<string, number>();
            for (const p of seasonPreds) {
              championCounts.set(p.table[0], (championCounts.get(p.table[0]) ?? 0) + 1);
            }
            const topChampion = [...championCounts.entries()].sort((a, b) => b[1] - a[1])[0];
            return (
              <section>
                <h2 className="mb-1 text-lg font-semibold text-zinc-100">
                  Table predictions — locked before the season
                </h2>
                <p className="mb-4 max-w-3xl text-sm text-zinc-400">
                  Every model predicted the final {data.comp.short_name} table before the opening
                  kickoff (hashed and tagged, like everything here).{" "}
                  {topChampion && (
                    <>
                      <span className="tabular-nums">{topChampion[1]}</span> of{" "}
                      <span className="tabular-nums">{seasonPreds.length}</span> models crown{" "}
                      <span className="font-medium text-zinc-200">{topChampion[0]}</span>.{" "}
                    </>
                  )}
                  {graded
                    ? "Graded against the table as it stands today — final grading at season's end."
                    : "Grading starts once results arrive."}
                </p>
                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-sm sm:min-w-[720px]">
                    <thead className="border-b border-zinc-800 bg-zinc-900/60">
                      <tr>
                        <th className={TH_CLS}>{graded ? "#" : ""}</th>
                        <th className={TH_CLS}>Model</th>
                        <th className={TH_CLS}>Champion pick</th>
                        <th className={`${TH_CLS} hidden md:table-cell`}>Predicted top 4</th>
                        <th className={`${TH_CLS} hidden md:table-cell`}>Predicted relegated</th>
                        {graded && <th className={`${TH_CLS} text-right`}>Score</th>}
                        {graded && (
                          <th className={`${TH_CLS} hidden text-right sm:table-cell`}>Detail</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/70">
                      {rows.map((r, i) => (
                        <tr key={r.pred.slug} className="hover:bg-zinc-900/40">
                          <td className={`${TD_CLS} w-10 tabular-nums text-zinc-500`}>
                            {graded ? i + 1 : ""}
                          </td>
                          <td className={TD_CLS}>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <Link
                                href={`/models/${r.pred.slug}/`}
                                className="font-medium text-zinc-100 hover:text-emerald-400"
                              >
                                {r.model?.label ?? r.pred.slug}
                              </Link>
                              {r.model && <TierChip tier={r.model.tier} />}
                            </div>
                          </td>
                          <td className={`${TD_CLS} text-zinc-200`}>
                            {r.pred.table[0]}
                            {graded && r.score?.champion && (
                              <span className="ml-1 text-emerald-400">✓</span>
                            )}
                          </td>
                          <td className={`${TD_CLS} hidden text-xs text-zinc-400 md:table-cell`}>
                            {r.pred.table.slice(0, 4).join(", ")}
                          </td>
                          <td className={`${TD_CLS} hidden text-xs text-zinc-400 md:table-cell`}>
                            {r.pred.table.slice(-relegationSpots).join(", ")}
                          </td>
                          {graded && (
                            <td
                              className={`${TD_CLS} text-right text-lg font-bold tabular-nums text-emerald-400`}
                            >
                              {r.score?.total ?? 0}
                            </td>
                          )}
                          {graded && (
                            <td
                              className={`${TD_CLS} hidden text-right text-xs tabular-nums text-zinc-400 sm:table-cell`}
                            >
                              {r.score
                                ? `${r.score.exact} exact · ${r.score.offByOne} ±1 · top4 ${r.score.topFourHits}/4 · rel ${r.score.relegationHits}/${relegationSpots}`
                                : ""}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                  Scoring: exact position 2 · one off 1 · champion +5 · each correct top-4 team +2 ·
                  each correct relegated team +2. Kept separate from the matchday leaderboard.
                </p>
              </section>
            );
          })()}

          {/* Rounds grid */}
          <section>
            <h2 className="mb-1 text-lg font-semibold text-zinc-100">Matchdays</h2>
            <p className="mb-4 text-sm text-zinc-400">
              Every round of the season. Open a matchday to compare all{" "}
              {data.leaderboard.length} models&apos; picks match by match.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {[...rounds.entries()].map(([round, fixtures]) => {
                const lock = data.manifest.rounds[mdKey(round)];
                const first = fixtures[0];
                return (
                  <Link
                    key={round}
                    href={`/leagues/${data.comp.id}/matches/${first.match}/`}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 transition-colors hover:border-emerald-400/50"
                  >
                    <p className="text-sm font-semibold text-zinc-100">Matchday {round}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
                      {fmtShortDateUtc(first.kickoff_utc)}
                    </p>
                    <p className={`mt-1 text-[11px] ${lock ? "text-emerald-300" : "text-zinc-500"}`}>
                      {lock ? (
                        <>
                          Locked ✓ <span className="tabular-nums">{lock.models}</span> models
                        </>
                      ) : (
                        "Picks pending"
                      )}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
