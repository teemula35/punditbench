import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  consensus,
  liveMatchInfo,
  loadSiteData,
  matchPredictionRows,
  matchupCalls,
  type LiveMatchInfo,
  type OutcomeSplit,
} from "@/lib/aggregate";
import { loadFixtures, loadRoster, loadTeams } from "@/lib/data";
import { fmtKickoffUtc } from "@/lib/format";
import { teamFlag } from "@/lib/prompt";
import { isKnockout } from "@/lib/scoring";
import { STAGE_LABELS } from "@/lib/types";
import type { Fixture } from "@/lib/types";
import { BreakdownChip, TD_CLS, TH_CLS, TierChip } from "../../ui";

export function generateStaticParams() {
  return loadFixtures().map((f) => ({ match: String(f.match) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ match: string }>;
}): Promise<Metadata> {
  const { match } = await params;
  const fixture = loadFixtures().find((f) => f.match === Number(match));
  if (!fixture) return { title: "Match not found" };
  return {
    title: `Match ${fixture.match}: ${fixture.home} vs ${fixture.away}`,
    description: `${loadRoster().length} LLM predictions for ${fixture.home} vs ${fixture.away} — ${STAGE_LABELS[fixture.stage]}, 2026 World Cup.`,
  };
}

export default async function MatchPage({ params }: { params: Promise<{ match: string }> }) {
  const { match } = await params;
  const data = loadSiteData();
  const teams = loadTeams();
  const fixture = data.fixtures.get(Number(match));
  if (!fixture) notFound();

  const result = data.results.get(fixture.match);
  const played =
    result?.status === "final" && result.home_goals !== undefined && result.away_goals !== undefined;
  const voided = result?.status === "voided";
  const knockout = isKnockout(fixture.stage);
  const rows = knockout ? [] : matchPredictionRows(data, fixture);
  const cons = knockout ? undefined : consensus(data, fixture);
  // Knockout: models never predicted real knockout fixtures directly — show
  // who had this exact pairing in their own simulated bracket instead.
  const calls = knockout ? matchupCalls(data, fixture) : [];
  // The round-by-round track: every model's DIRECT pick on this real fixture
  // (separate benchmark from the locked bracket above).
  const live = knockout ? liveMatchInfo(data, fixture) : undefined;
  const withStageFile = knockout
    ? data.leaderboard.filter((e) => e.files.some((f) => f.stage === fixture.stage)).length
    : 0;
  const simPending = knockout ? data.leaderboard.length - withStageFile : 0;

  const stageLabel =
    fixture.stage === "group" ? `Group ${fixture.group}` : STAGE_LABELS[fixture.stage];

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Match {fixture.match} · {stageLabel}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <span className="text-4xl sm:text-5xl" aria-hidden="true">
              {teamFlag(teams, fixture.home)}
            </span>
            <span className="text-xl font-bold text-zinc-50 sm:text-2xl">{fixture.home}</span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-zinc-50 sm:text-3xl">
            {played ? (
              <>
                {result.home_goals}–{result.away_goals}
              </>
            ) : (
              <span className="text-zinc-600">vs</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-4xl sm:text-5xl" aria-hidden="true">
              {teamFlag(teams, fixture.away)}
            </span>
            <span className="text-xl font-bold text-zinc-50 sm:text-2xl">{fixture.away}</span>
          </div>
        </div>
        <div className="mt-4 space-y-1 text-sm text-zinc-400">
          {voided && (
            <p className="font-semibold text-rose-300">
              Voided — excluded from scoring for all models.
            </p>
          )}
          {!played && !voided && (
            <p className="font-medium text-zinc-300">
              Upcoming — kicks off {fmtKickoffUtc(fixture.kickoff_utc)}
              {fixture.time_unverified ? " (time unverified)" : ""}
            </p>
          )}
          {played && result.advances && (
            <p>
              Advances: <span className="font-medium text-zinc-200">{result.advances}</span>
            </p>
          )}
          {result?.note && <p className="text-zinc-500">{result.note}</p>}
          <p className="text-zinc-500">
            {fixture.stadium ? `${fixture.stadium}, ` : ""}
            {fixture.city} · {fmtKickoffUtc(fixture.kickoff_utc)}
          </p>
        </div>
      </header>

      {knockout && live && live.state === "picks" && (
        <RoundByRoundSection info={live} fixture={fixture} played={played} />
      )}
      {knockout ? (
        /* The locked self-consistent bracket: every model simulated its own
           knockout tournament before kickoff. The round-by-round track (the
           "predict the real fixture" benchmark) is a separate section. */
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-100">Who called this matchup?</h2>
            <p className="text-xs text-zinc-500">
              All bracket simulations were locked &amp; pre-registered before the opening kickoff.
            </p>
          </div>
          <p className="mb-3 max-w-3xl text-sm text-zinc-400">
            Models whose own simulated {STAGE_LABELS[fixture.stage]} contained this exact pairing
            (in either orientation), with the scoreline they attached to it —{" "}
            <span className="tabular-nums">{calls.length}</span> of{" "}
            <span className="tabular-nums">{withStageFile}</span> models with a stored simulation
            for this round.
          </p>
          {calls.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-5">
              <p className="text-sm text-zinc-400">
                No model&apos;s simulated bracket paired these teams in the{" "}
                {STAGE_LABELS[fixture.stage]}. Models can still earn advancement points here for
                having either team reach this stage — see the{" "}
                <Link href="/methodology/" className="text-emerald-400 hover:underline">
                  methodology
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-sm sm:min-w-[480px]">
                <thead className="border-b border-zinc-800 bg-zinc-900/60">
                  <tr>
                    <th className={TH_CLS}>Model</th>
                    <th className={`${TH_CLS} text-right`}>Their call</th>
                    <th className={TH_CLS}>Advances</th>
                    {played && <th className={`${TH_CLS} text-right`}>Points</th>}
                    {played && <th className={TH_CLS}>Breakdown</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {calls.map((call) => (
                    <tr key={call.entry.slug} className="hover:bg-zinc-900/40">
                      <td className={TD_CLS}>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link
                            href={`/models/${call.entry.slug}/`}
                            className="font-medium text-zinc-100 hover:text-emerald-400"
                          >
                            {call.entry.model.label}
                          </Link>
                          <TierChip tier={call.entry.model.tier} />
                        </div>
                      </td>
                      <td className={`${TD_CLS} text-right font-semibold tabular-nums text-zinc-100`}>
                        {call.prediction ? (
                          `${call.prediction.home_goals}-${call.prediction.away_goals}`
                        ) : (
                          <span className="font-normal text-zinc-600" title="no valid scoreline stored">
                            —
                          </span>
                        )}
                      </td>
                      <td className={`${TD_CLS} text-zinc-300`}>
                        {call.prediction?.advances ?? <span className="text-zinc-600">—</span>}
                      </td>
                      {played && (
                        <td className={`${TD_CLS} text-right font-bold tabular-nums text-emerald-400`}>
                          {call.score?.points ?? 0}
                        </td>
                      )}
                      {played && (
                        <td className={TD_CLS}>
                          {call.score ? (
                            <BreakdownChip
                              breakdown={call.score.breakdown}
                              bonus={call.score.advance_bonus}
                            />
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-zinc-600">
            Scorelines are shown in this match&apos;s orientation (flipped when a model simulated
            the pairing the other way around). Each listed model also earns a +1 matchup bonus;
            scoreline points (3/2/1, +1 correct advancer) apply once the match is played.
            {simPending > 0 &&
              ` ${simPending} model${simPending === 1 ? "" : "s"} ${simPending === 1 ? "has" : "have"} no valid simulation for this round (retry policy exhausted — see methodology).`}
          </p>
        </section>
      ) : (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-100">Model predictions</h2>
            {!played && !voided && (
              <p className="text-xs text-zinc-500">
                Locked — all predictions were pre-registered before kickoff.
              </p>
            )}
          </div>
          {cons && (
            <p className="mb-3 text-sm text-zinc-400">
              Consensus scoreline:{" "}
              <span className="font-semibold tabular-nums text-zinc-100">
                {cons.home}-{cons.away}
              </span>{" "}
              <span className="text-zinc-500">
                ({cons.count} of {cons.outOf} models)
              </span>
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm sm:min-w-[480px]">
              <thead className="border-b border-zinc-800 bg-zinc-900/60">
                <tr>
                  <th className={TH_CLS}>Model</th>
                  <th className={`${TH_CLS} text-right`}>Prediction</th>
                  {played && <th className={`${TH_CLS} text-right`}>Points</th>}
                  {played && <th className={TH_CLS}>Breakdown</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {rows.map((row) => (
                  <tr key={row.entry.slug} className="hover:bg-zinc-900/40">
                    <td className={TD_CLS}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          href={`/models/${row.entry.slug}/`}
                          className="font-medium text-zinc-100 hover:text-emerald-400"
                        >
                          {row.entry.model.label}
                        </Link>
                        <TierChip tier={row.entry.model.tier} />
                      </div>
                    </td>
                    <td className={`${TD_CLS} text-right font-semibold tabular-nums text-zinc-100`}>
                      {row.prediction ? (
                        `${row.prediction.home_goals}-${row.prediction.away_goals}`
                      ) : row.fileExists ? (
                        <span className="font-normal text-zinc-600" title="no valid prediction">
                          —
                        </span>
                      ) : (
                        <span className="text-xs font-normal italic text-zinc-500">
                          no valid prediction
                        </span>
                      )}
                    </td>
                    {played && (
                      <td className={`${TD_CLS} text-right font-bold tabular-nums text-emerald-400`}>
                        {row.score?.points ?? 0}
                      </td>
                    )}
                    {played && (
                      <td className={TD_CLS}>
                        {row.score ? (
                          <BreakdownChip breakdown={row.score.breakdown} bonus={row.score.advance_bonus} />
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            “—” means the model returned no valid prediction for this match
            {rows.some((r) => !r.fileExists) ? "; models without a stored file are pending" : ""}. A
            missing prediction scores 0 once the match is played.
          </p>
        </section>
      )}
      {knockout && live && live.state !== "picks" && (
        <RoundByRoundSection info={live} fixture={fixture} played={played} />
      )}
    </div>
  );
}

/** "26 of 38 back Germany" / "12 of 38 call a draw" — the most-backed 90' outcome. */
function splitSummary(split: OutcomeSplit, fixture: Fixture): string {
  const { home, draw, away, outOf } = split;
  if (home >= away && home >= draw) return `${home} of ${outOf} back ${fixture.home}`;
  if (away >= draw) return `${away} of ${outOf} back ${fixture.away}`;
  return `${draw} of ${outOf} call a draw`;
}

/**
 * Round-by-round picks for one knockout fixture: the separate benchmark in which
 * every model predicts the REAL pairing directly. Three states — collected
 * picks, "not pre-registered" (already kicked off when the round was collected),
 * and pending (round not collected yet).
 */
function RoundByRoundSection({
  info,
  fixture,
  played,
}: {
  info: LiveMatchInfo;
  fixture: Fixture;
  played: boolean;
}) {
  const stageLabel = STAGE_LABELS[fixture.stage];

  if (info.state === "excluded") {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">Round-by-round picks</h2>
        <div className="rounded-lg border border-dashed border-amber-400/30 bg-amber-400/5 p-5">
          <p className="text-sm text-zinc-300">
            <span className="font-semibold text-amber-300">Not pre-registered.</span>{" "}
            {info.excludedReason} The round-by-round track only counts picks locked before a match
            kicks off, so no live picks were collected for this one — the locked bracket calls still
            apply.
          </p>
        </div>
      </section>
    );
  }

  if (info.state === "pending") {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">Round-by-round picks</h2>
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-5">
          <p className="text-sm text-zinc-400">
            Once the real {stageLabel} bracket is set, every model is shown the actual pairings and
            results so far, then predicts this exact tie — locked &amp; pre-registered before it
            kicks off. The picks appear here then.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-100">Round-by-round picks</h2>
        <p className="text-xs text-zinc-500">Locked &amp; pre-registered before kickoff.</p>
      </div>
      <p className="mb-3 max-w-3xl text-sm text-zinc-400">
        Shown the real {stageLabel} bracket and every result so far, each model predicted this exact
        tie directly — <span className="tabular-nums">{info.modelsWithPick}</span> of{" "}
        <span className="tabular-nums">{info.modelsWithFile}</span> models returned a valid pick.
      </p>
      {info.consensus && (
        <p className="mb-3 text-sm text-zinc-400">
          Most-predicted score:{" "}
          <span className="font-semibold tabular-nums text-zinc-100">
            {info.consensus.home}–{info.consensus.away}
          </span>{" "}
          <span className="text-zinc-500">
            ({info.consensus.count} of {info.consensus.outOf})
          </span>
          {info.split && (
            <>
              <span className="text-zinc-600"> · </span>
              {splitSummary(info.split, fixture)}
            </>
          )}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm sm:min-w-[480px]">
          <thead className="border-b border-zinc-800 bg-zinc-900/60">
            <tr>
              <th className={TH_CLS}>Model</th>
              <th className={`${TH_CLS} text-right`}>Pick</th>
              <th className={TH_CLS}>Advances</th>
              {played && <th className={`${TH_CLS} text-right`}>Points</th>}
              {played && <th className={TH_CLS}>Breakdown</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {info.rows.map((row) => (
              <tr key={row.entry.slug} className="hover:bg-zinc-900/40">
                <td className={TD_CLS}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/models/${row.entry.slug}/`}
                      className="font-medium text-zinc-100 hover:text-emerald-400"
                    >
                      {row.entry.model.label}
                    </Link>
                    <TierChip tier={row.entry.model.tier} />
                  </div>
                </td>
                <td className={`${TD_CLS} text-right font-semibold tabular-nums text-zinc-100`}>
                  {row.prediction ? (
                    `${row.prediction.home_goals}-${row.prediction.away_goals}`
                  ) : row.fileExists ? (
                    <span className="font-normal text-zinc-600" title="no valid pick">
                      —
                    </span>
                  ) : (
                    <span className="text-xs font-normal italic text-zinc-500">no pick</span>
                  )}
                </td>
                <td className={`${TD_CLS} text-zinc-300`}>
                  {row.prediction?.advances ?? <span className="text-zinc-600">—</span>}
                </td>
                {played && (
                  <td className={`${TD_CLS} text-right font-bold tabular-nums text-emerald-400`}>
                    {row.score?.points ?? 0}
                  </td>
                )}
                {played && (
                  <td className={TD_CLS}>
                    {row.score ? (
                      <BreakdownChip breakdown={row.score.breakdown} bonus={row.score.advance_bonus} />
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        Direct picks on the real fixture, scored like a group match (exact 3 · goal difference 2 ·
        outcome 1) plus +1 for the correct advancing team — a separate benchmark from the locked
        self-consistent bracket. See the{" "}
        <Link href="/methodology/" className="text-emerald-400 hover:underline">
          methodology
        </Link>
        .
      </p>
    </section>
  );
}
