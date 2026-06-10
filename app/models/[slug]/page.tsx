import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSiteData, predictionFor } from "@/lib/aggregate";
import { loadRoster, loadTeams } from "@/lib/data";
import { fmtShortDateUtc } from "@/lib/format";
import { modelSlug, teamFlag } from "@/lib/prompt";
import type { Fixture, StageId } from "@/lib/types";
import { KNOCKOUT_STAGES, STAGE_LABELS } from "@/lib/types";
import { BreakdownChip, MatchLink, TD_CLS, TH_CLS, TierChip } from "../../ui";

const STAGE_ORDER: StageId[] = ["group", ...KNOCKOUT_STAGES];

export function generateStaticParams() {
  return loadRoster().map((m) => ({ slug: modelSlug(m.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const model = loadRoster().find((m) => modelSlug(m.id) === slug);
  if (!model) return { title: "Model not found" };
  return {
    title: model.label,
    description: `${model.label} (${model.vendor}) — all 2026 World Cup predictions and points on PunditBench.`,
  };
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-zinc-50">{value}</p>
    </div>
  );
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = loadSiteData();
  const teams = loadTeams();
  const entry = data.leaderboard.find((e) => e.slug === slug);
  if (!entry) notFound();

  const { model, totals, scores, files } = entry;
  const anyResults = data.playedCount > 0;
  const cutoffKnown = model.knowledge_cutoff && model.knowledge_cutoff !== "unknown";

  const stagesWithFixtures = STAGE_ORDER.filter((s) =>
    [...data.fixtures.values()].some((f) => f.stage === s),
  );

  // Biggest hits: top 3 by points, then earliest match. Only points > 0.
  const hits = [...scores.values()]
    .filter((s) => s.points > 0)
    .sort((a, b) => b.points - a.points || a.match - b.match)
    .slice(0, 3);

  // Worst misses: 0-pt predictions (not missing), most total goals error first.
  const misses = [...scores.values()]
    .filter((s) => s.points === 0 && s.breakdown === "none")
    .map((s) => {
      const fixture = data.fixtures.get(s.match);
      const result = data.results.get(s.match);
      const p = fixture ? predictionFor(entry, fixture) : undefined;
      const error =
        p && result?.home_goals !== undefined && result.away_goals !== undefined
          ? Math.abs(p.home_goals - result.home_goals) + Math.abs(p.away_goals - result.away_goals)
          : 0;
      return { score: s, error };
    })
    .sort((a, b) => b.error - a.error || a.score.match - b.score.match)
    .slice(0, 3);

  const highlight = (matchNo: number) => {
    const fixture = data.fixtures.get(matchNo);
    const result = data.results.get(matchNo);
    const p = fixture ? predictionFor(entry, fixture) : undefined;
    if (!fixture || !result) return null;
    return { fixture, result, p };
  };

  return (
    <div className="space-y-10">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
            {model.label}
          </h1>
          <TierChip tier={model.tier} />
        </div>
        <div className="mt-3 space-y-1 text-sm text-zinc-400">
          <p>
            {model.vendor} · <span className="font-mono text-xs text-zinc-500">{model.id}</span>
          </p>
          <p className="text-zinc-500">
            Knowledge cutoff: {cutoffKnown ? model.knowledge_cutoff : "not published"}
            {model.context_length
              ? ` · context ${model.context_length.toLocaleString("en-US")} tokens`
              : ""}
          </p>
        </div>
      </header>

      {!entry.hasPredictions ? (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
          <p className="text-lg font-semibold text-zinc-100">Predictions pending</p>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            No prediction file has been stored for this model yet. Predictions are collected
            stage-by-stage and pre-registered before kickoff — check back once the next collection
            run is published.
          </p>
        </section>
      ) : (
        <>
          {/* Totals */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Points" value={<span className="text-emerald-400">{totals.points}</span>} />
            <Stat label="Rank" value={`#${entry.rank}`} />
            <Stat label="Exact" value={totals.exact} />
            <Stat label="Goal diff" value={totals.gd} />
            <Stat label="Outcome" value={totals.outcome} />
            <Stat label="Advance hits" value={totals.advances} />
          </section>

          {/* Per-stage points + run details */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-semibold text-zinc-100">Points by stage</h2>
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-zinc-800/70">
                    {stagesWithFixtures.map((stage) => (
                      <tr key={stage}>
                        <td className={`${TD_CLS} text-zinc-300`}>{STAGE_LABELS[stage]}</td>
                        <td className={`${TD_CLS} text-right font-semibold tabular-nums text-zinc-100`}>
                          {files.some((f) => f.stage === stage) ? (
                            (totals.perStage[stage] ?? 0)
                          ) : (
                            <span className="text-xs font-normal italic text-zinc-500">
                              predictions pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-lg font-semibold text-zinc-100">Collection runs</h2>
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-900/60">
                    <tr>
                      <th className={TH_CLS}>Stage</th>
                      <th className={TH_CLS}>Params</th>
                      <th className={`${TH_CLS} text-right`}>Attempts</th>
                      <th className={`${TH_CLS} text-right`}>Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {STAGE_ORDER.filter((s) => files.some((f) => f.stage === s)).map((stage) => {
                      const file = files.find((f) => f.stage === stage)!;
                      return (
                        <tr key={stage}>
                          <td className={`${TD_CLS} text-zinc-300`}>{STAGE_LABELS[stage]}</td>
                          <td className={`${TD_CLS} font-mono text-xs text-zinc-500`}>
                            {Object.keys(file.params).length > 0
                              ? JSON.stringify(file.params)
                              : "provider defaults"}
                          </td>
                          <td className={`${TD_CLS} text-right tabular-nums text-zinc-400`}>
                            {file.attempts}
                          </td>
                          <td className={`${TD_CLS} text-right tabular-nums text-zinc-400`}>
                            {file.usage?.cost_usd !== undefined
                              ? `$${file.usage.cost_usd.toFixed(4)}`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Hits and misses */}
          {anyResults && (hits.length > 0 || misses.length > 0) && (
            <section className="grid gap-6 lg:grid-cols-2">
              {hits.length > 0 && (
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-zinc-100">Biggest hits</h2>
                  <ul className="space-y-2">
                    {hits.map((s) => {
                      const h = highlight(s.match);
                      if (!h || !h.p) return null;
                      return (
                        <li
                          key={s.match}
                          className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm"
                        >
                          <MatchLink match={s.match}>
                            {h.fixture.home} vs {h.fixture.away}
                          </MatchLink>{" "}
                          <span className="text-zinc-400">
                            — predicted{" "}
                            <span className="font-semibold tabular-nums text-zinc-100">
                              {h.p.home_goals}-{h.p.away_goals}
                            </span>
                            , actual{" "}
                            <span className="font-semibold tabular-nums text-zinc-100">
                              {h.result.home_goals}-{h.result.away_goals}
                            </span>{" "}
                            ·{" "}
                            <span className="font-bold text-emerald-400">{s.points} pts</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {misses.length > 0 && (
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-zinc-100">Worst misses</h2>
                  <ul className="space-y-2">
                    {misses.map(({ score: s, error }) => {
                      const h = highlight(s.match);
                      if (!h || !h.p) return null;
                      return (
                        <li
                          key={s.match}
                          className="rounded-lg border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm"
                        >
                          <MatchLink match={s.match}>
                            {h.fixture.home} vs {h.fixture.away}
                          </MatchLink>{" "}
                          <span className="text-zinc-400">
                            — predicted{" "}
                            <span className="font-semibold tabular-nums text-zinc-100">
                              {h.p.home_goals}-{h.p.away_goals}
                            </span>
                            , actual{" "}
                            <span className="font-semibold tabular-nums text-zinc-100">
                              {h.result.home_goals}-{h.result.away_goals}
                            </span>{" "}
                            · <span className="text-rose-300">{error} goals off</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Full prediction table per stage */}
          {stagesWithFixtures.map((stage) => {
            const stageFixtures = [...data.fixtures.values()]
              .filter((f) => f.stage === stage)
              .sort((a, b) => a.match - b.match);
            const file = files.find((f) => f.stage === stage);
            return (
              <section key={stage}>
                <h2 className="mb-3 text-lg font-semibold text-zinc-100">
                  {STAGE_LABELS[stage]}
                  {!file && (
                    <span className="ml-3 text-sm font-normal italic text-zinc-500">
                      predictions pending
                    </span>
                  )}
                </h2>
                {file && (
                  <div className="overflow-x-auto rounded-lg border border-zinc-800">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="border-b border-zinc-800 bg-zinc-900/60">
                        <tr>
                          <th className={TH_CLS}>#</th>
                          <th className={TH_CLS}>Match</th>
                          <th className={`${TH_CLS} text-right`}>Predicted</th>
                          <th className={`${TH_CLS} text-right`}>Actual</th>
                          <th className={`${TH_CLS} text-right`}>Pts</th>
                          <th className={TH_CLS}>Breakdown</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70">
                        {stageFixtures.map((fixture: Fixture) => {
                          const p = file.predictions.find((x) => x.match === fixture.match);
                          const result = data.results.get(fixture.match);
                          const s = scores.get(fixture.match);
                          const played =
                            result?.status === "final" && result.home_goals !== undefined;
                          return (
                            <tr key={fixture.match} className="hover:bg-zinc-900/40">
                              <td className={`${TD_CLS} w-10 tabular-nums text-zinc-600`}>
                                {fixture.match}
                              </td>
                              <td className={TD_CLS}>
                                <MatchLink match={fixture.match}>
                                  <span className="text-zinc-200">
                                    <span aria-hidden="true">{teamFlag(teams, fixture.home)}</span>{" "}
                                    {fixture.home}
                                    <span className="mx-1 text-zinc-600">v</span>
                                    <span aria-hidden="true">{teamFlag(teams, fixture.away)}</span>{" "}
                                    {fixture.away}
                                  </span>
                                </MatchLink>
                                <span className="ml-2 whitespace-nowrap text-xs text-zinc-600">
                                  {fmtShortDateUtc(fixture.kickoff_utc)}
                                </span>
                              </td>
                              <td
                                className={`${TD_CLS} text-right font-semibold tabular-nums text-zinc-100`}
                              >
                                {p ? (
                                  <>
                                    {p.home_goals}-{p.away_goals}
                                    {p.advances && (
                                      <span className="ml-1.5 text-xs font-normal text-zinc-500">
                                        adv: {p.advances}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="font-normal text-zinc-600" title="no valid prediction">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className={`${TD_CLS} text-right tabular-nums text-zinc-300`}>
                                {result?.status === "voided" ? (
                                  <span className="text-xs uppercase text-rose-300">voided</span>
                                ) : played ? (
                                  `${result.home_goals}-${result.away_goals}`
                                ) : (
                                  <span className="text-zinc-600">—</span>
                                )}
                              </td>
                              <td
                                className={`${TD_CLS} text-right font-bold tabular-nums text-emerald-400`}
                              >
                                {s ? s.points : <span className="font-normal text-zinc-600">—</span>}
                              </td>
                              <td className={TD_CLS}>
                                {s ? (
                                  <BreakdownChip breakdown={s.breakdown} bonus={s.advance_bonus} />
                                ) : (
                                  <span className="text-xs text-zinc-600">
                                    {result?.status === "voided" ? "excluded" : "upcoming"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
          <p className="text-xs text-zinc-600">
            “—” in the Predicted column means the model returned no valid prediction for that match
            (scores 0 once played). Raw request/response logs for this model are published in the{" "}
            <Link href="/about/" className="text-emerald-400 hover:underline">
              data exports
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
