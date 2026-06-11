/** Small shared server-side presentational components. */
import Link from "next/link";
import type { Breakdown, Fixture, MatchResult, RosterModel, Team } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/types";
import { teamFlag } from "@/lib/prompt";
import { fmtKickoffUtc } from "@/lib/format";

export function Wordmark() {
  return (
    <span className="text-lg font-bold tracking-tight text-zinc-50">
      Pundit<span className="text-emerald-400">Bench</span>
    </span>
  );
}

const TIER_STYLES: Record<RosterModel["tier"], string> = {
  flagship: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  mid: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  small: "border-zinc-700 bg-zinc-800/60 text-zinc-400",
  legacy: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  oddball: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300",
};

export function TierChip({ tier }: { tier: RosterModel["tier"] }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TIER_STYLES[tier]}`}
    >
      {tier}
    </span>
  );
}

const BREAKDOWN_STYLES: Record<Breakdown, { label: string; cls: string }> = {
  exact: { label: "exact", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
  gd: { label: "goal diff", cls: "border-sky-400/40 bg-sky-400/10 text-sky-300" },
  outcome: { label: "outcome", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  none: { label: "miss", cls: "border-zinc-700 bg-zinc-800/40 text-zinc-500" },
  missing: { label: "no valid prediction", cls: "border-rose-400/30 bg-rose-400/10 text-rose-300" },
};

export function BreakdownChip({ breakdown, bonus }: { breakdown: Breakdown; bonus?: 0 | 1 }) {
  const s = BREAKDOWN_STYLES[breakdown];
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.cls}`}
      >
        {s.label}
      </span>
      {bonus === 1 && (
        <span className="inline-block rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
          +1 adv
        </span>
      )}
    </span>
  );
}

export function StageBadge({ fixture }: { fixture: Fixture }) {
  const label = fixture.stage === "group" ? `Group ${fixture.group}` : STAGE_LABELS[fixture.stage];
  return (
    <span className="inline-block whitespace-nowrap rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
      {label}
    </span>
  );
}

export function TeamLabel({ teams, name }: { teams: Team[]; name: string }) {
  return (
    <span className="whitespace-nowrap">
      <span aria-hidden="true">{teamFlag(teams, name)}</span> {name}
    </span>
  );
}

/** "🇲🇽 Mexico 2–1 South Africa 🇿🇦" or "🇲🇽 Mexico vs South Africa 🇿🇦". */
export function MatchTeams({
  teams,
  fixture,
  result,
}: {
  teams: Team[];
  fixture: Fixture;
  result?: MatchResult;
}) {
  const played =
    result?.status === "final" && result.home_goals !== undefined && result.away_goals !== undefined;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <TeamLabel teams={teams} name={fixture.home} />
      {played ? (
        <span className="font-semibold tabular-nums text-zinc-50">
          {result.home_goals}–{result.away_goals}
        </span>
      ) : (
        <span className="text-zinc-600">vs</span>
      )}
      <TeamLabel teams={teams} name={fixture.away} />
    </span>
  );
}

export function ScoreOrKickoff({ result, fixture }: { result?: MatchResult; fixture: Fixture }) {
  if (result?.status === "voided") {
    return <span className="text-xs uppercase tracking-wider text-rose-300">voided</span>;
  }
  if (result?.status === "final" && result.home_goals !== undefined) {
    return (
      <span className="font-semibold tabular-nums text-zinc-50">
        {result.home_goals}–{result.away_goals}
        {result.note && <span className="ml-1.5 text-xs font-normal text-zinc-500">{result.note}</span>}
      </span>
    );
  }
  return <span className="text-sm tabular-nums text-zinc-500">{fmtKickoffUtc(fixture.kickoff_utc)}</span>;
}

export function PageTitle({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <header className="mb-8">
      {kicker && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">{kicker}</p>
      )}
      <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">{title}</h1>
      {sub && <p className="mt-2 max-w-2xl text-sm text-zinc-400">{sub}</p>}
    </header>
  );
}

export function MatchLink({ match, children }: { match: number; children: React.ReactNode }) {
  return (
    <Link
      href={`/matches/${match}/`}
      className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-400"
    >
      {children}
    </Link>
  );
}

export const TH_CLS =
  "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500";
export const TD_CLS = "px-3 py-2.5 align-baseline";
