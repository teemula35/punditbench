import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCompetitionFixtures, loadCompetitions, loadRoster } from "@/lib/data";
import { fmtKickoffUtc } from "@/lib/format";
import { leagueMatchInfo, loadLeagueData, type LeagueMatchInfo } from "@/lib/league-aggregate";
import { roundLabel } from "@/lib/types";
import type { Competition, Fixture } from "@/lib/types";
import { BreakdownChip, TD_CLS, TH_CLS, TierChip } from "../../../../ui";

export function generateStaticParams() {
  return loadCompetitions().flatMap((c) =>
    loadCompetitionFixtures(c.id).map((f) => ({ comp: c.id, match: String(f.match) })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ comp: string; match: string }>;
}): Promise<Metadata> {
  const { comp, match } = await params;
  const c = loadCompetitions().find((x) => x.id === comp);
  const fixture = c && loadCompetitionFixtures(c.id).find((f) => f.match === Number(match));
  if (!c || !fixture) return { title: "Match not found" };
  return {
    title: `${c.short_name} ${roundLabel(fixture.stage)}: ${fixture.home} vs ${fixture.away}`,
    description: `${loadRoster().length} LLM picks for ${fixture.home} vs ${fixture.away} — ${roundLabel(fixture.stage)}, ${c.name}.`,
  };
}

export default async function LeagueMatchPage({
  params,
}: {
  params: Promise<{ comp: string; match: string }>;
}) {
  const { comp: compId, match } = await params;
  if (!loadCompetitions().some((c) => c.id === compId)) notFound();
  const data = loadLeagueData(compId);
  const fixture = data.fixtures.get(Number(match));
  if (!fixture) notFound();

  const result = data.results.get(fixture.match);
  const played =
    result?.status === "final" && result.home_goals !== undefined && result.away_goals !== undefined;
  const voided = result?.status === "voided";
  const info = leagueMatchInfo(data, fixture);

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          <Link href={`/leagues/${data.comp.id}/`} className="hover:underline">
            {data.comp.name}
          </Link>{" "}
          · {roundLabel(fixture.stage)} · Match {fixture.match}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="text-xl font-bold text-zinc-50 sm:text-2xl">{fixture.home}</span>
          <div className="text-2xl font-bold tabular-nums text-zinc-50 sm:text-3xl">
            {played ? (
              <>
                {result.home_goals}–{result.away_goals}
              </>
            ) : (
              <span className="text-zinc-600">vs</span>
            )}
          </div>
          <span className="text-xl font-bold text-zinc-50 sm:text-2xl">{fixture.away}</span>
          {played && (
            <span className="inline-block rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              FT
            </span>
          )}
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
          {result?.note && <p className="text-zinc-500">{result.note}</p>}
          <p className="text-zinc-500">
            {fixture.stadium ? `${fixture.stadium}, ` : ""}
            {fixture.city} · {fmtKickoffUtc(fixture.kickoff_utc)}
          </p>
        </div>
      </header>

      <PicksSection info={info} fixture={fixture} comp={data.comp} played={played} />
    </div>
  );
}

/** "26 of 40 back Arsenal" / "12 of 40 call a draw" — the most-backed outcome. */
function splitSummary(split: NonNullable<LeagueMatchInfo["split"]>, fixture: Fixture): string {
  const { home, draw, away, outOf } = split;
  if (home >= away && home >= draw) return `${home} of ${outOf} back ${fixture.home}`;
  if (away >= draw) return `${away} of ${outOf} back ${fixture.away}`;
  return `${draw} of ${outOf} call a draw`;
}

/**
 * The round-by-round league picks for one fixture. Three states — collected
 * picks, "not pre-registered" (excluded when the round was locked), and
 * pending (round not locked yet).
 */
function PicksSection({
  info,
  fixture,
  comp,
  played,
}: {
  info: LeagueMatchInfo;
  fixture: Fixture;
  comp: Competition;
  played: boolean;
}) {
  const stageLabel = roundLabel(fixture.stage);

  if (info.state === "excluded") {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">Model picks</h2>
        <div className="rounded-lg border border-dashed border-amber-400/30 bg-amber-400/5 p-5">
          <p className="text-sm text-zinc-300">
            <span className="font-semibold text-amber-300">Not pre-registered.</span>{" "}
            {info.excludedReason} The league benchmark only counts picks locked before a match
            kicks off, so no picks were collected for this one — it is excluded from every
            model&apos;s scoring.
          </p>
        </div>
      </section>
    );
  }

  if (info.state === "pending") {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">Model picks</h2>
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-5">
          <p className="text-sm text-zinc-400">
            Picks lock ~36h before this round&apos;s first kickoff. Every model is shown the
            current {comp.short_name} table and each team&apos;s recent form, then predicts this
            exact scoreline — locked &amp; SHA-256 pre-registered before the round begins. The
            picks appear here once the {stageLabel} round locks.
          </p>
        </div>
      </section>
    );
  }

  const withPick = info.rows.filter((r) => r.prediction).length;
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-100">Model picks</h2>
        <p className="text-xs text-zinc-500">
          Locked &amp; pre-registered
          {info.lockedAt ? ` ${fmtKickoffUtc(info.lockedAt)}` : " before kickoff"}.
        </p>
      </div>
      <p className="mb-3 max-w-3xl text-sm text-zinc-400">
        Shown the {comp.short_name} table and recent form at lock time, each model predicted this
        match directly — <span className="tabular-nums">{withPick}</span> of{" "}
        <span className="tabular-nums">{info.rows.length}</span> models returned a valid pick.
      </p>
      {info.consensus && (
        <p className="mb-3 text-sm text-zinc-400">
          Most predicted:{" "}
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
              {played && <th className={`${TH_CLS} text-right`}>Points</th>}
              {played && <th className={TH_CLS}>Breakdown</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {info.rows.map((row) => (
              <tr key={row.slug} className="hover:bg-zinc-900/40">
                <td className={TD_CLS}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/models/${row.slug}/`}
                      className="font-medium text-zinc-100 hover:text-emerald-400"
                    >
                      {row.model.label}
                    </Link>
                    <TierChip tier={row.model.tier} />
                  </div>
                </td>
                <td className={`${TD_CLS} text-right font-semibold tabular-nums text-zinc-100`}>
                  {row.prediction ? (
                    `${row.prediction.home_goals}-${row.prediction.away_goals}`
                  ) : (
                    <span className="text-xs font-normal italic text-zinc-500">no pick</span>
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
                      <BreakdownChip breakdown={row.score.breakdown} />
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
        Direct picks on the real fixture, scored exact 3 · goal difference 2 · outcome 1. &ldquo;no
        pick&rdquo; means the model returned no valid pick within the retry policy; it scores 0
        once the match is played. See the{" "}
        <Link href="/methodology/" className="text-emerald-400 hover:underline">
          methodology
        </Link>
        .
      </p>
    </section>
  );
}
