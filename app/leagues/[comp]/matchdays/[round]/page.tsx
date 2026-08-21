import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCompetitions } from "@/lib/data";
import { fmtKickoffUtc } from "@/lib/format";
import { loadLeagueData } from "@/lib/league-aggregate";
import { mdKey, roundLabel } from "@/lib/types";

export function generateStaticParams() {
  return loadCompetitions().flatMap((competition) =>
    Array.from({ length: competition.round_count }, (_, index) => ({
      comp: competition.id,
      round: String(index + 1),
    })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ comp: string; round: string }>;
}): Promise<Metadata> {
  const { comp, round } = await params;
  const competition = loadCompetitions().find((item) => item.id === comp);
  const roundNumber = Number(round);
  if (!competition || !Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > competition.round_count) {
    return { title: "Matchday not found" };
  }
  const label = roundLabel(mdKey(roundNumber));
  return {
    title: `${competition.short_name} ${label}: fixtures and LLM picks`,
    description: `${label} fixtures for ${competition.name}, with kickoff times and LLM score predictions locked and pre-registered before the round begins.`,
  };
}

export default async function LeagueMatchdayPage({
  params,
}: {
  params: Promise<{ comp: string; round: string }>;
}) {
  const { comp: compId, round } = await params;
  const roundNumber = Number(round);
  const competition = loadCompetitions().find((item) => item.id === compId);
  if (!competition || !Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > competition.round_count) {
    notFound();
  }

  const data = loadLeagueData(compId);
  const fixtures = [...data.fixtures.values()]
    .filter((fixture) => (fixture.round ?? Number(fixture.stage.slice(2))) === roundNumber)
    .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.match - b.match);
  if (fixtures.length === 0) notFound();

  const lock = data.manifest.rounds[mdKey(roundNumber)];
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          <Link href={`/leagues/${data.comp.id}/`} className="hover:underline">
            {data.comp.name}
          </Link>
          {" · "}
          {roundLabel(mdKey(roundNumber))}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          {data.comp.short_name} {roundLabel(mdKey(roundNumber))} fixtures
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
          Kickoff times and every fixture in this round. Model score predictions are locked and
          pre-registered before the round begins, then graded from synced final results. Any
          post-lock scoring exception is disclosed on its fixture and kept out of the benchmark.
        </p>
        <p className="mt-3 text-sm text-zinc-500">
          {lock
            ? `${lock.models} models’ picks locked ${fmtKickoffUtc(lock.locked_at)}.`
            : "Picks lock about 36 hours before this round’s first kickoff."}
        </p>
      </header>

      <section aria-label={`${roundLabel(mdKey(roundNumber))} fixtures`}>
        <div className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
          {fixtures.map((fixture) => {
            const result = data.results.get(fixture.match);
            const played =
              result?.status === "final" &&
              result.home_goals !== undefined &&
              result.away_goals !== undefined;
            const scoringExclusion = data.scoringExclusions.get(fixture.match);
            return (
              <Link
                key={fixture.match}
                href={`/leagues/${data.comp.id}/matches/${fixture.match}/`}
                className="block bg-zinc-900/40 px-4 py-4 transition-colors hover:bg-zinc-900/80"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                  <div className="flex items-center gap-x-3 text-base font-semibold text-zinc-100">
                    <span>{fixture.home}</span>
                    <span className="tabular-nums text-zinc-400">
                      {played ? `${result.home_goals}–${result.away_goals}` : "vs"}
                    </span>
                    <span>{fixture.away}</span>
                  </div>
                  <span className="text-sm tabular-nums text-zinc-400">
                    {played ? "Final" : fmtKickoffUtc(fixture.kickoff_utc)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {fixture.stadium ? `${fixture.stadium} · ` : ""}
                  {fixture.city}
                </p>
                {scoringExclusion && (
                  <p className="mt-2 text-xs leading-5 text-amber-300">
                    <span className="font-semibold">Fixture corrected after lock.</span> The locked
                    picks were for {scoringExclusion.locked_fixture.home} vs{" "}
                    {scoringExclusion.locked_fixture.away}; they remain archived but unscored and
                    are not reinterpreted for this corrected fixture.
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
