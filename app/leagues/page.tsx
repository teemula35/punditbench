import type { Metadata } from "next";
import Link from "next/link";
import { OpeningRoundBriefCard } from "@/app/briefs/opening-round-2026/card";
import { loadCompetitions, loadLeagueRoster } from "@/lib/data";
import { fmtKickoffUtc, fmtShortDateUtc } from "@/lib/format";
import { loadLeagueData, nextRound, type LeagueData } from "@/lib/league-aggregate";
import { PageTitle } from "../ui";

export const metadata: Metadata = {
  title: "Leagues",
  description:
    "The league benchmark: LLMs predict Europe's top leagues one matchday at a time — form-aware picks, locked and pre-registered before every round.",
};

/** One-line season status derived from fixtures + results. */
function statusLine(data: LeagueData): string {
  if (data.totalFixtures === 0) return "Fixtures not yet published";
  if (data.playedCount >= data.totalFixtures) return "Season complete";
  const next = nextRound(data);
  if (data.playedCount === 0) {
    const first = next?.fixtures[0];
    return first ? `Season starts ${fmtShortDateUtc(first.kickoff_utc)}` : "Season starts soon";
  }
  if (!next) return "Season complete";
  const started = next.fixtures.some((f) => data.results.has(f.match));
  return started
    ? `Live — Matchday ${next.round} in progress`
    : `Live — Matchday ${next.round} up next`;
}

export default function LeaguesPage() {
  const rosterCount = loadLeagueRoster().length;
  const cards = loadCompetitions().map((comp) => ({ comp, data: loadLeagueData(comp.id) }));

  return (
    <div className="space-y-8">
      <PageTitle
        kicker="Season 2026-27"
        title="Leagues"
        sub={`After the World Cup, the benchmark moves to club football: ${rosterCount} LLMs are tracked across Europe's top leagues one matchday at a time, each from its disclosed competition start.`}
      />

      <OpeningRoundBriefCard />

      <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
        Unlike the knowledge-only World Cup prompts, league picks are form-aware: before each
        round every eligible model is shown the current table and each team&apos;s recent results, then
        predicts every scoreline of the matchday. Picks lock ~36h before each round&apos;s first
        kickoff and are SHA-256 pre-registered, so nothing can be edited after the fact. A round
        locks as one unit, so where a matchday is split across weeks by a deferred fixture, its
        later matches are pre-registered further ahead than its opener. Scoring:
        exact score 3 · goal difference 2 · outcome 1.{" "}
        <Link
          href="/methodology/"
          className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-400"
        >
          Read the full methodology →
        </Link>
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ comp, data }) => {
          const status = statusLine(data);
          const noFixtures = data.totalFixtures === 0;
          const first = nextRound(data)?.fixtures[0];
          return (
            <Link
              key={comp.id}
              href={`/leagues/${comp.id}/`}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-emerald-400/50"
            >
              <p className="text-xs uppercase tracking-wider text-zinc-500">{comp.season_label}</p>
              <p className="mt-1 text-base font-semibold text-zinc-100">{comp.short_name}</p>
              <p
                className={`mt-2 text-xs font-medium ${noFixtures ? "italic text-zinc-500" : "text-emerald-300"}`}
              >
                {status}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                {comp.team_count} teams · {comp.round_count} matchdays
                {data.totalFixtures > 0 && (
                  <>
                    {" "}
                    · <span className="tabular-nums">{data.totalFixtures}</span> fixtures
                  </>
                )}
              </p>
              {data.playedCount === 0 && first && (
                <p className="mt-1 text-xs tabular-nums text-zinc-500">
                  First kickoff {fmtKickoffUtc(first.kickoff_utc)}
                </p>
              )}
              {data.playedCount > 0 && (
                <p className="mt-1 text-xs tabular-nums text-zinc-500">
                  {data.playedCount} of {data.totalFixtures} played
                </p>
              )}
            </Link>
          );
        })}
      </div>

      <p className="max-w-3xl text-xs text-zinc-600">
        Every competition uses the same scoring. Competition-specific starts are flagged, earlier
        rounds are never backfilled, and points per scored match keeps partial-season records
        comparable. The 2026 World Cup benchmark stays fully browsable as the archived season zero.
      </p>
    </div>
  );
}
