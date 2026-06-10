import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSiteData, predictionFor } from "@/lib/aggregate";
import { simulateGroups } from "@/lib/bracket";
import { bracketView, type SimMatchView } from "@/lib/bracket-view";
import { loadRoster, loadTeams } from "@/lib/data";
import { fmtShortDateUtc } from "@/lib/format";
import { modelSlug, teamFlag } from "@/lib/prompt";
import type { TableRow } from "@/lib/standings";
import type { StageId, Team } from "@/lib/types";
import { KNOCKOUT_STAGES, STAGE_LABELS } from "@/lib/types";
import { BreakdownChip, MatchLink, TD_CLS, TH_CLS, TeamLabel, TierChip } from "../../ui";

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
    description: `${model.label} (${model.vendor}) — its complete predicted 2026 World Cup: group tables, knockout bracket, champion and points on PunditBench.`,
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

/** One mini-table of the model's own predicted group standings. */
function MiniGroupTable({
  group,
  rows,
  qualifiedThirds,
  teams,
}: {
  group: string;
  rows: TableRow[];
  qualifiedThirds: Set<string>;
  teams: Team[];
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
      <h3 className="mb-2 text-sm font-semibold text-zinc-100">
        Group <span className="text-emerald-400">{group}</span>
      </h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            <th className="px-1 py-1 text-left">#</th>
            <th className="px-1 py-1 text-left">Team</th>
            <th className="px-1 py-1 text-right">Pts</th>
            <th className="px-1 py-1 text-right">GD</th>
            <th className="px-1 py-1 text-right">GF</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {rows.map((row, i) => {
            const direct = i < 2;
            const third = i === 2 && qualifiedThirds.has(row.team);
            return (
              <tr
                key={row.team}
                className={direct ? "bg-emerald-400/5" : third ? "bg-sky-400/5" : undefined}
              >
                <td className="px-1 py-1 tabular-nums text-zinc-600">{i + 1}</td>
                <td
                  className={`px-1 py-1 ${
                    direct || third ? "font-medium text-zinc-100" : "text-zinc-400"
                  }`}
                >
                  <span aria-hidden="true">{teamFlag(teams, row.team)}</span> {row.team}
                </td>
                <td className="px-1 py-1 text-right font-semibold tabular-nums text-zinc-200">
                  {row.points}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-zinc-400">
                  {row.gd > 0 ? `+${row.gd}` : row.gd}
                </td>
                <td className="px-1 py-1 text-right tabular-nums text-zinc-400">{row.gf}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One simulated knockout pairing: flags, teams, predicted score, advancer. */
function SimCard({ m, teams }: { m: SimMatchView; teams: Team[] }) {
  const rows = [
    { name: m.home, goals: m.prediction?.home_goals },
    { name: m.away, goals: m.prediction?.away_goals },
  ];
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-2.5 py-2">
      <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">M{m.match}</p>
      {rows.map((r) => {
        const winner = m.advances === r.name;
        return (
          <div key={r.name} className="flex items-baseline justify-between gap-2 text-xs">
            <span className={`truncate ${winner ? "font-semibold text-zinc-100" : "text-zinc-500"}`}>
              <span aria-hidden="true">{teamFlag(teams, r.name)}</span> {r.name}
            </span>
            <span className={`tabular-nums ${winner ? "font-semibold text-zinc-100" : "text-zinc-500"}`}>
              {r.goals ?? "—"}
            </span>
          </div>
        );
      })}
      {m.isDraw && m.advances && (
        <p className="mt-1">
          <span className="inline-block rounded-full border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-px text-[10px] font-semibold text-emerald-300">
            adv: {m.advances}
          </span>
        </p>
      )}
    </div>
  );
}

const PENDING_CARD =
  "rounded-md border border-dashed border-zinc-800 px-3 py-4 text-center text-xs italic text-zinc-600";

/** One column of the bracket tree; `matches` undefined → stage still pending. */
function StageColumn({
  label,
  matches,
  teams,
  children,
}: {
  label: string;
  matches?: SimMatchView[];
  teams: Team[];
  children?: React.ReactNode;
}) {
  return (
    <div className="flex w-56 shrink-0 flex-col">
      <h3 className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </h3>
      <div className="flex flex-1 flex-col justify-around gap-2">
        {matches ? (
          matches.map((m) => <SimCard key={m.match} m={m} teams={teams} />)
        ) : (
          <div className={PENDING_CARD}>simulation pending</div>
        )}
        {children}
      </div>
    </div>
  );
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = loadSiteData();
  const teams = loadTeams();
  const entry = data.leaderboard.find((e) => e.slug === slug);
  if (!entry) notFound();

  const { model, totals, bracket, scores, files } = entry;
  const anyResults = data.playedCount > 0;
  const realKnockoutExists = [...data.fixtures.values()].some((f) => f.stage !== "group");
  const cutoffKnown = model.knowledge_cutoff && model.knowledge_cutoff !== "unknown";

  const groupFixtures = [...data.fixtures.values()]
    .filter((f) => f.stage === "group")
    .sort((a, b) => a.match - b.match);
  const groupFile = files.find((f) => f.stage === "group");

  // The model's own universe: its predicted group tables + stored bracket.
  const sim = groupFile ? simulateGroups(groupFile, teams, groupFixtures) : undefined;
  const qualifiedThirds = new Set(sim?.thirdsRanked.slice(0, 8).map((r) => r.team) ?? []);
  const view = bracketView(files);
  const thirdMatches = view.stages.get("third");

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
            <Stat
              label="Total points"
              value={<span className="text-emerald-400">{entry.totalPoints}</span>}
            />
            <Stat label="Rank" value={`#${entry.rank}`} />
            <Stat label="Group pts" value={totals.points} />
            <Stat label="Bracket pts" value={bracket.total} />
            <Stat label="Exact" value={entry.exactCount} />
            <Stat
              label="Champion pick"
              value={
                entry.championPick ? (
                  <TeamLabel teams={teams} name={entry.championPick} />
                ) : (
                  <span className="text-sm font-normal italic text-zinc-500">
                    simulation pending
                  </span>
                )
              }
            />
          </section>

          {/* The model's own universe: predicted group tables */}
          {sim && (
            <section>
              <h2 className="mb-1 text-lg font-semibold text-zinc-100">Predicted group tables</h2>
              <p className="mb-4 max-w-3xl text-sm text-zinc-400">
                The group stage exactly as this model imagined it, computed from its own 72
                predicted scorelines with FIFA tiebreakers.{" "}
                <span className="text-emerald-300">Green</span> rows qualify directly,{" "}
                <span className="text-sky-300">blue</span> rows are its eight best third-placed
                teams (slotted into the Round of 32 via FIFA&apos;s Annexe C table).
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...sim.tables.entries()].map(([group, rows]) => (
                  <MiniGroupTable
                    key={group}
                    group={group}
                    rows={rows}
                    qualifiedThirds={qualifiedThirds}
                    teams={teams}
                  />
                ))}
              </div>
            </section>
          )}

          {/* The model's own universe: predicted bracket */}
          <section>
            <h2 className="mb-1 text-lg font-semibold text-zinc-100">Predicted bracket</h2>
            {view.stages.size === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-6">
                <p className="text-sm font-semibold text-zinc-200">No valid bracket simulation</p>
                <p className="mt-1 max-w-xl text-sm text-zinc-500">
                  This model could not produce valid knockout predictions within the retry policy
                  (see the methodology&apos;s failure rules) — its raw attempts are in the published
                  audit logs. Its Round-of-32 qualifiers still score: they follow deterministically
                  from its group predictions above.
                </p>
              </div>
            ) : (
              <>
                <p className="mb-4 max-w-3xl text-sm text-zinc-400">
                  The knockout tournament that follows from this model&apos;s own predictions: each
                  card is a simulated pairing with the model&apos;s predicted 90-minute score (the
                  advancing team is highlighted; &ldquo;adv&rdquo; marks a predicted draw decided
                  after 90 minutes).
                  {view.pendingStages.length > 0 &&
                    " Remaining rounds are still being collected."}
                </p>
                <div className="overflow-x-auto pb-2">
                  <div className="flex min-w-[72rem] gap-3">
                    {(["r32", "r16", "qf", "sf"] as StageId[]).map((stage) => (
                      <StageColumn
                        key={stage}
                        label={STAGE_LABELS[stage]}
                        matches={view.stages.get(stage)}
                        teams={teams}
                      />
                    ))}
                    <StageColumn
                      label={STAGE_LABELS.final}
                      matches={view.stages.get("final")}
                      teams={teams}
                    >
                      {view.champion ? (
                        <div className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-2.5 text-center">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">
                            Predicted champion
                          </p>
                          <p className="mt-1 text-sm font-bold text-emerald-300">
                            <span aria-hidden="true">🏆</span>{" "}
                            <span aria-hidden="true">{teamFlag(teams, view.champion)}</span>{" "}
                            {view.champion}
                          </p>
                        </div>
                      ) : (
                        <div className={PENDING_CARD}>champion pending</div>
                      )}
                      <div>
                        <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                          Third-place match
                        </p>
                        {thirdMatches ? (
                          thirdMatches.map((m) => <SimCard key={m.match} m={m} teams={teams} />)
                        ) : (
                          <div className={PENDING_CARD}>simulation pending</div>
                        )}
                      </div>
                    </StageColumn>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Bracket points breakdown */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-100">Bracket points</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Advancement" value={bracket.advancement} />
              <Stat label="Matchups called" value={bracket.matchupHits} />
              <Stat label="Matched scorelines" value={bracket.matchupPoints} />
              <Stat
                label="Bracket total"
                value={<span className="text-emerald-400">{bracket.total}</span>}
              />
            </div>
            <p className="mt-2 max-w-3xl text-xs text-zinc-600">
              Scored against the real knockout tournament: advancement points for every real team
              this model had reaching each stage (R32 1 · R16 2 · QF 3 · SF 5 · final 8 · champion
              13), +1 for each simulated pairing that actually occurs in that round, and matched
              pairings&apos; scorelines scored like normal matches (3/2/1, +1 correct advancer).
              {realKnockoutExists
                ? ""
                : " The real bracket doesn't exist yet — everything sits at 0 and starts paying out automatically once the real Round of 32 is set."}
            </p>
          </section>

          {/* Collection runs */}
          <section className="max-w-2xl">
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
            {!entry.bracketComplete && (
              <p className="mt-2 text-xs italic text-zinc-500">
                Bracket incomplete — this model&apos;s later knockout rounds failed validation within
                the retry policy (raw attempts are in the published audit logs); rounds it did
                answer, and everything they determine, still count.
              </p>
            )}
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

          {/* Full group-stage prediction table */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-100">
              Group-stage predictions
              {!groupFile && (
                <span className="ml-3 text-sm font-normal italic text-zinc-500">
                  predictions pending
                </span>
              )}
            </h2>
            {groupFile && (
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
                    {groupFixtures.map((fixture) => {
                      const p = groupFile.predictions.find((x) => x.match === fixture.match);
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
                              `${p.home_goals}-${p.away_goals}`
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
          <p className="text-xs text-zinc-600">
            “—” in the Predicted column means the model returned no valid prediction for that match
            (scores 0 once played). Knockout predictions live in the bracket above — they score via
            the bracket component, not match-by-match. Raw request/response logs for this model are
            published in the{" "}
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
