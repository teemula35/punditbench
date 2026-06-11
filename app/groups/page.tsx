import type { Metadata } from "next";
import Link from "next/link";
import {
  loadFixtures,
  loadGroupOrderOverride,
  loadResults,
  loadTeams,
  loadThirdOrderOverride,
  resultsByMatch,
} from "@/lib/data";
import { fmtShortDateUtc } from "@/lib/format";
import { teamFlag } from "@/lib/prompt";
import { groupTable, thirdPlaceRanking, type TableRow } from "@/lib/standings";
import { PageTitle, TD_CLS, TH_CLS, TeamLabel } from "../ui";

export const metadata: Metadata = {
  title: "Groups",
  description: "Live group tables for all 12 groups of the 2026 World Cup.",
};

const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const NUM_TD = `${TD_CLS} text-right tabular-nums`;

function StandingsTable({ rows, teams }: { rows: TableRow[]; teams: ReturnType<typeof loadTeams> }) {
  // <sm keeps #, Team, P, GD, Pts; W/D/L/GF/GA reappear from sm up
  // (hidden sm:table-cell on matching th + td).
  return (
    <table className="w-full text-sm sm:min-w-[420px]">
      <thead className="border-b border-zinc-800 bg-zinc-900/60">
        <tr>
          <th className={TH_CLS}>#</th>
          <th className={TH_CLS}>Team</th>
          <th className={`${TH_CLS} text-right`}>P</th>
          <th className={`${TH_CLS} hidden text-right sm:table-cell`}>W</th>
          <th className={`${TH_CLS} hidden text-right sm:table-cell`}>D</th>
          <th className={`${TH_CLS} hidden text-right sm:table-cell`}>L</th>
          <th className={`${TH_CLS} hidden text-right sm:table-cell`}>GF</th>
          <th className={`${TH_CLS} hidden text-right sm:table-cell`}>GA</th>
          <th className={`${TH_CLS} text-right`}>GD</th>
          <th className={`${TH_CLS} text-right`}>Pts</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800/70">
        {rows.map((row, i) => (
          <tr key={row.team} className={i < 2 ? "bg-emerald-400/5" : undefined}>
            <td className={`${TD_CLS} w-8 tabular-nums text-zinc-500`}>{i + 1}</td>
            <td className={`${TD_CLS} font-medium text-zinc-100`}>
              <TeamLabel teams={teams} name={row.team} />
            </td>
            <td className={`${NUM_TD} text-zinc-400`}>{row.played}</td>
            <td className={`${NUM_TD} hidden text-zinc-400 sm:table-cell`}>{row.won}</td>
            <td className={`${NUM_TD} hidden text-zinc-400 sm:table-cell`}>{row.drawn}</td>
            <td className={`${NUM_TD} hidden text-zinc-400 sm:table-cell`}>{row.lost}</td>
            <td className={`${NUM_TD} hidden text-zinc-400 sm:table-cell`}>{row.gf}</td>
            <td className={`${NUM_TD} hidden text-zinc-400 sm:table-cell`}>{row.ga}</td>
            <td className={`${NUM_TD} text-zinc-300`}>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
            <td className={`${NUM_TD} font-bold text-emerald-400`}>{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function GroupsPage() {
  const teams = loadTeams();
  const fixtures = loadFixtures();
  const results = resultsByMatch();
  const groupOverride = loadGroupOrderOverride();
  const thirdOverride = loadThirdOrderOverride();
  const anyResults = loadResults().some((r) => r.status === "final");

  const tables = new Map<string, TableRow[]>();
  for (const g of GROUPS) {
    tables.set(g, groupTable(g, teams, fixtures, results, groupOverride?.[g]));
  }
  const thirds = thirdPlaceRanking(tables, thirdOverride);

  return (
    <div>
      <PageTitle
        kicker="Group stage"
        title="Groups"
        sub="The top two of each of the 12 groups advance to the Round of 32, joined by the 8 best third-placed teams. Tables follow the official tiebreakers (points, goal difference, goals scored, head-to-head)."
      />
      <div className="grid gap-8 lg:grid-cols-2">
        {GROUPS.map((g) => {
          const groupFixtures = fixtures
            .filter((f) => f.group === g)
            .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.match - b.match);
          return (
            <section key={g} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
              <h2 className="mb-3 text-lg font-semibold text-zinc-100">
                Group <span className="text-emerald-400">{g}</span>
              </h2>
              <div className="overflow-x-auto">
                <StandingsTable rows={tables.get(g)!} teams={teams} />
              </div>
              <ul className="mt-3 space-y-1 border-t border-zinc-800/70 pt-3 text-xs text-zinc-400">
                {groupFixtures.map((f) => {
                  const r = results.get(f.match);
                  const played = r?.status === "final" && r.home_goals !== undefined;
                  return (
                    <li key={f.match} className="flex items-baseline justify-between gap-2">
                      <Link href={`/matches/${f.match}/`} className="truncate hover:text-emerald-400">
                        <span aria-hidden="true">{teamFlag(teams, f.home)}</span> {f.home}{" "}
                        {played ? (
                          <span className="font-semibold tabular-nums text-zinc-200">
                            {r.home_goals}–{r.away_goals}
                          </span>
                        ) : (
                          <span className="text-zinc-600">v</span>
                        )}{" "}
                        <span aria-hidden="true">{teamFlag(teams, f.away)}</span> {f.away}
                        {r?.status === "voided" && (
                          <span className="ml-1 uppercase text-rose-300">voided</span>
                        )}
                      </Link>
                      <span className="shrink-0 tabular-nums text-zinc-600">
                        {fmtShortDateUtc(f.kickoff_utc)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {anyResults && thirds.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-zinc-100">Third-placed teams</h2>
          <p className="mb-3 max-w-2xl text-sm text-zinc-400">
            The 8 best third-placed teams (highlighted rows would currently advance) join the group
            winners and runners-up in the Round of 32.
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm sm:min-w-[420px]">
              <thead className="border-b border-zinc-800 bg-zinc-900/60">
                <tr>
                  <th className={TH_CLS}>#</th>
                  <th className={TH_CLS}>Team</th>
                  <th className={`${TH_CLS} text-right`}>P</th>
                  <th className={`${TH_CLS} text-right`}>GD</th>
                  <th className={`${TH_CLS} text-right`}>GF</th>
                  <th className={`${TH_CLS} text-right`}>Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {thirds.map((row, i) => (
                  <tr key={row.team} className={i < 8 ? "bg-emerald-400/5" : undefined}>
                    <td className={`${TD_CLS} w-8 tabular-nums text-zinc-500`}>{i + 1}</td>
                    <td className={`${TD_CLS} font-medium text-zinc-100`}>
                      <TeamLabel teams={teams} name={row.team} />
                    </td>
                    <td className={`${NUM_TD} text-zinc-400`}>{row.played}</td>
                    <td className={`${NUM_TD} text-zinc-300`}>
                      {row.gd > 0 ? `+${row.gd}` : row.gd}
                    </td>
                    <td className={`${NUM_TD} text-zinc-400`}>{row.gf}</td>
                    <td className={`${NUM_TD} font-bold text-emerald-400`}>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
