/**
 * End-of-tournament report card, one per model — the single-screen summary the
 * model pages and social cards render: where the locked bracket finished, how
 * the round-by-round track went, what the whole thing cost, and how the
 * champion call actually turned out.
 *
 * Everything is derived from the SiteData snapshot (lib/aggregate.ts) on every
 * call; nothing here is stored. Points come straight from lib/scoring so a
 * report card can never drift from the leaderboard or from `npm run audit`:
 * the locked side is read off the leaderboard entry, and the round-by-round
 * side re-runs the same scoring pass `npm run audit -- --live` prints.
 */
import type { LeaderboardEntry, SiteData } from "./aggregate";
import { traitBand } from "./personality";
import { rank, scoreModel, totalsFor } from "./scoring";
import type { Fixture, MatchResult, ModelTotals, PredictionFile, RoundKey } from "./types";

export interface ReportCard {
  slug: string;
  label: string;
  vendor: string;
  tier: string;
  /** The model's own predicted world champion, from its simulated final. */
  championPick?: string;
  /** Did that pick win the real tournament? */
  championCorrect: boolean;
  /** How the picked team actually finished, e.g. "won it", "out in the round of 16". */
  championFate?: string;
  /** Locked (pre-kickoff) leaderboard total: group match points + bracket points. */
  lockedPoints: number;
  lockedRank: number;
  /** Exact scorelines behind the locked total (group + matched knockout pairings). */
  exactCount: number;
  /** Round-by-round (live) points; undefined when the model has no live picks. */
  livePoints?: number;
  /** Rank within the field of models that have live picks; undefined alongside livePoints. */
  liveRank?: number;
  /** Total inference spend across every stored prediction file, locked + live. */
  costUsd: number;
  /** Derived one-liner combining spend, standing and the champion call. */
  verdict: string;
}

/** How a team's tournament ended, keyed by the round it went out in. */
// Keyed by RoundKey rather than StageId so league matchdays type-check; they
// simply have no exit label (a matchday eliminates nobody), and teamFate only
// ever runs over World Cup fixtures anyway.
const EXIT_LABEL: Partial<Record<RoundKey, string>> = {
  group: "out in the group stage",
  r32: "out in the round of 32",
  r16: "out in the round of 16",
  qf: "out in the quarter-finals",
  // Only reachable if no third-place match exists; otherwise a beaten
  // semi-finalist's last fixture is the third-place match.
  sf: "out in the semi-finals",
};

/**
 * Where a team's real run ended: its last knockout fixture with a final result
 * decides the wording, and a team that never appears in the knockout draw went
 * out in the group stage. Returns undefined when the answer isn't knowable yet
 * — an unknown team, a knockout draw that hasn't been made, or a team still in
 * the tournament.
 */
export function teamFate(
  team: string,
  fixtures: Map<number, Fixture>,
  results: Map<number, MatchResult>,
): string | undefined {
  const all = [...fixtures.values()];
  const knockouts = all
    .filter((f) => f.stage !== "group" && (f.home === team || f.away === team))
    .sort((a, b) => a.match - b.match);

  if (knockouts.length === 0) {
    // "No knockout fixture" only means elimination once the draw exists, and
    // only for a team that is actually in the tournament.
    const entrant = all.some((f) => f.home === team || f.away === team);
    return entrant && all.some((f) => f.stage === "r32") ? EXIT_LABEL.group : undefined;
  }

  const last = knockouts[knockouts.length - 1];
  const result = results.get(last.match);
  if (!result || result.status !== "final" || !result.advances) return undefined;
  const won = result.advances === team;
  if (last.stage === "final") return won ? "won it" : "lost the final";
  if (last.stage === "third") return won ? "finished third" : "finished fourth";
  // Won its last knockout match with no later fixture drawn yet → still in it.
  return won ? undefined : EXIT_LABEL[last.stage];
}

/** Total recorded inference spend over a set of stored prediction files. */
function spend(files: PredictionFile[]): number {
  return files.reduce((sum, f) => sum + (f.usage?.cost_usd ?? 0), 0);
}

/** Sub-cent spends read better as a fraction than as a string of zeros. */
const CENT_FRACTION = new Map<number, string>([
  [1, "a cent"],
  [2, "half a cent"],
  [3, "a third of a cent"],
  [4, "a quarter of a cent"],
  [5, "a fifth of a cent"],
]);

/**
 * Spend in words. The roster spans four orders of magnitude — a third of a
 * cent to sixteen dollars — so only the dollar end gets a dollar figure; below
 * a dime it reads as whole cents, and below a cent as a fraction of one.
 */
export function costPhrase(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "nothing";
  if (usd >= 0.1) return `$${usd.toFixed(2)}`;
  const cents = usd * 100;
  if (cents >= 1.5) return `${Math.round(cents)} cents`;
  return CENT_FRACTION.get(Math.round(1 / cents)) ?? "a fraction of a cent";
}

/**
 * A leaderboard position in words. Below the podium it falls back to the same
 * thirds-of-the-field banding the personality traits use.
 */
export function standingPhrase(position: number, fieldSize: number): string {
  if (position === 1) return "top of the table";
  if (position <= 3) return "top 3";
  const band = traitBand(position, fieldSize);
  return band === 1 ? "the top third" : band === -1 ? "bottom of the table" : "mid-table";
}

/** The champion clause: what it backed, and how that ended. */
function championClause(card: Omit<ReportCard, "verdict">): string {
  if (!card.championPick) return "it never named a champion";
  if (card.championCorrect) return `it called ${card.championPick}`;
  return card.championFate
    ? `it backed ${card.championPick} (${card.championFate})`
    : `it backed ${card.championPick}`;
}

/** "$16.30 and top 3 — it called Spain." */
function verdictLine(card: Omit<ReportCard, "verdict">, fieldSize: number): string {
  const standing = standingPhrase(card.lockedRank, fieldSize);
  return `${costPhrase(card.costUsd)} and ${standing} — ${championClause(card)}.`;
}

/**
 * Round-by-round totals for one model, scored exactly as the live audit does:
 * the same lib/scoring pass over the real fixtures, minus the matches the
 * models were never asked (already kicked off when that round was collected).
 */
function liveTotalsFor(
  entry: LeaderboardEntry,
  fixtures: Map<number, Fixture>,
  results: Map<number, MatchResult>,
): ModelTotals {
  return totalsFor(entry.slug, scoreModel(entry.liveFiles, fixtures, results), fixtures);
}

/** A report card per model slug, in leaderboard order. */
export function reportCards(data: SiteData): Map<string, ReportCard> {
  const liveResults = new Map([...data.results].filter(([match]) => !data.liveExcluded.has(match)));
  const withLive = data.leaderboard.filter((e) => e.liveFiles.length > 0);
  // Live ranking is field-relative, so it is computed over the whole live
  // field in one pass (same dense ranking + tiebreakers as the audit).
  const liveRank = new Map(
    rank(withLive.map((e) => liveTotalsFor(e, data.fixtures, liveResults))).map((r) => [
      r.totals.slug,
      r,
    ]),
  );

  const out = new Map<string, ReportCard>();
  for (const entry of data.leaderboard) {
    const live = liveRank.get(entry.slug);
    const base: Omit<ReportCard, "verdict"> = {
      slug: entry.slug,
      label: entry.model.label,
      vendor: entry.model.vendor,
      tier: entry.model.tier,
      championPick: entry.championPick,
      championCorrect: entry.bracket.championCorrect,
      championFate: entry.championPick
        ? teamFate(entry.championPick, data.fixtures, data.results)
        : undefined,
      lockedPoints: entry.totalPoints,
      lockedRank: entry.rank,
      exactCount: entry.exactCount,
      livePoints: live?.totals.points,
      liveRank: live?.rank,
      costUsd: spend(entry.files) + spend(entry.liveFiles),
    };
    out.set(entry.slug, { ...base, verdict: verdictLine(base, data.leaderboard.length) });
  }
  return out;
}

/** One model's report card; undefined for a slug that isn't on the roster. */
export function reportCardFor(data: SiteData, slug: string): ReportCard | undefined {
  return reportCards(data).get(slug);
}
