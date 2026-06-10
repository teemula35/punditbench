import type { Metadata } from "next";
import Link from "next/link";
import { bestCall, loadSiteData } from "@/lib/aggregate";
import { loadTeams } from "@/lib/data";
import { fmtLongDateUtc, utcDateKey } from "@/lib/format";
import type { Fixture } from "@/lib/types";
import { MatchTeams, PageTitle, ScoreOrKickoff, StageBadge, TD_CLS } from "../ui";

export const metadata: Metadata = {
  title: "Matches",
  description: "Every 2026 World Cup match with kickoff times, results and the models' best calls.",
};

export default function MatchesPage() {
  const data = loadSiteData();
  const teams = loadTeams();

  const fixtures = [...data.fixtures.values()].sort(
    (a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.match - b.match,
  );

  const byDate = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const key = utcDateKey(f.kickoff_utc);
    const list = byDate.get(key) ?? [];
    list.push(f);
    byDate.set(key, list);
  }

  return (
    <div>
      <PageTitle
        kicker="Schedule & results"
        title="Matches"
        sub={`All ${data.totalFixtures} matches of the tournament — ${data.fixtures.size} scheduled so far, ${data.playedCount} played. Knockout fixtures appear once the real bracket is known. All times UTC.`}
      />
      <div className="space-y-8">
        {[...byDate.entries()].map(([date, dayFixtures]) => (
          <section key={date}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-emerald-400">
              {fmtLongDateUtc(dayFixtures[0].kickoff_utc)}
            </h2>
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full min-w-[560px] text-sm">
                <tbody className="divide-y divide-zinc-800/70">
                  {dayFixtures.map((f) => {
                    const result = data.results.get(f.match);
                    const best = bestCall(data, f);
                    return (
                      <tr key={f.match} className="hover:bg-zinc-900/40">
                        <td className={`${TD_CLS} w-12 tabular-nums text-zinc-600`}>{f.match}</td>
                        <td className={`${TD_CLS} w-28`}>
                          <StageBadge fixture={f} />
                        </td>
                        <td className={TD_CLS}>
                          <Link href={`/matches/${f.match}/`} className="hover:text-emerald-400">
                            <MatchTeams teams={teams} fixture={f} result={result} />
                          </Link>
                          {result?.status === "final" && (
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {best ? (
                                <>
                                  Best:{" "}
                                  <Link
                                    href={`/models/${best.slug}/`}
                                    className="text-zinc-400 hover:text-emerald-400"
                                  >
                                    {best.label}
                                  </Link>{" "}
                                  <span className="tabular-nums">
                                    {best.prediction.home_goals}-{best.prediction.away_goals}
                                  </span>
                                  , {best.points} pts
                                  {best.tiedWith > 0 && ` (+${best.tiedWith} tied)`}
                                </>
                              ) : (
                                "Best: no model scored"
                              )}
                            </p>
                          )}
                        </td>
                        <td className={`${TD_CLS} whitespace-nowrap text-right`}>
                          <ScoreOrKickoff result={result} fixture={f} />
                        </td>
                        <td className={`${TD_CLS} w-16 text-right`}>
                          <Link
                            href={`/matches/${f.match}/`}
                            className="text-xs text-emerald-400 hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
