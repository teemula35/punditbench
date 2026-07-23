import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSiteData, predictionFor } from "@/lib/aggregate";
import { simulateGroups } from "@/lib/bracket";
import { bracketView, type SimMatchView } from "@/lib/bracket-view";
import { loadRoster, loadTeams } from "@/lib/data";
import { fmtShortDateUtc } from "@/lib/format";
import { traitBand, type Personality, type TraitKey } from "@/lib/personality";
import { modelSlug, teamFlag } from "@/lib/prompt";
import { reportCardFor, type ReportCard } from "@/lib/report-card";
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

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Inference spend at a readable precision: "$8.15", "$0.003", "<$0.001". */
function fmtCost(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0.00";
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.001) return `$${usd.toFixed(3)}`;
  return "<$0.001";
}

/** One report-card tile: a headline figure over the line that supports it. */
function ReportStat({
  label,
  value,
  detail,
  tone = "plain",
}: {
  label: string;
  value: React.ReactNode;
  detail: React.ReactNode;
  /** Colour-codes the two tracks: emerald = locked bracket, sky = round-by-round. */
  tone?: "plain" | "locked" | "live";
}) {
  const valueCls =
    tone === "locked" ? "text-emerald-400" : tone === "live" ? "text-sky-300" : "text-zinc-50";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${valueCls}`}>{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

/**
 * End-of-tournament summary: the verdict, what actually became of the champion
 * pick, and the model's two placings — the tournament it locked in before
 * kickoff against its round-by-round picks on the real bracket.
 */
function ReportCardSection({ card, teams }: { card: ReportCard; teams: Team[] }) {
  const hasLive = card.liveRank !== undefined || card.livePoints !== undefined;
  // Ranks count upward from 1, so a positive gap means the live track placed better.
  const rankGap = card.liveRank !== undefined ? card.lockedRank - card.liveRank : undefined;
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-zinc-100">World Cup report card</h2>
      <p className="mb-4 max-w-3xl border-l-2 border-emerald-400/50 pl-3 text-base font-medium leading-snug text-zinc-200">
        {card.verdict}
      </p>

      <div
        className={`mb-3 rounded-lg border px-4 py-3 ${
          card.championCorrect
            ? "border-emerald-400/30 bg-emerald-400/5"
            : "border-zinc-800 bg-zinc-900/40"
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Champion pick
        </p>
        {card.championPick ? (
          <>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-lg font-bold text-zinc-50">
                <span aria-hidden="true">🏆</span>{" "}
                <TeamLabel teams={teams} name={card.championPick} />
              </span>
              <span
                className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  card.championCorrect
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                    : "border-rose-400/30 bg-rose-400/10 text-rose-300"
                }`}
              >
                {card.championCorrect ? "correct" : "wrong"}
              </span>
            </div>
            {card.championFate && (
              <p className="mt-1.5 max-w-3xl text-sm text-zinc-400">{card.championFate}</p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm italic text-zinc-500">
            No champion pick — this model never produced a valid final.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportStat
          label="Locked bracket"
          value={`#${card.lockedRank}`}
          detail={`${card.lockedPoints} pts · locked pre-kickoff`}
          tone="locked"
        />
        <ReportStat
          label="Round-by-round"
          value={card.liveRank !== undefined ? `#${card.liveRank}` : "—"}
          detail={
            card.livePoints !== undefined
              ? `${card.livePoints} pts · picked each round`
              : "no live picks"
          }
          tone={card.liveRank !== undefined ? "live" : "plain"}
        />
        <ReportStat label="Exact scorelines" value={card.exactCount} detail="called to the goal" />
        <ReportStat
          label="Inference cost"
          value={fmtCost(card.costUsd)}
          detail="every prompt, every round"
        />
      </div>

      {rankGap !== undefined ? (
        <p className="mt-3 max-w-3xl text-sm text-zinc-400">
          {rankGap === 0
            ? `The same placing on both tracks — #${card.lockedRank} whether it committed to a whole tournament up front or picked each real round as it came.`
            : `${Math.abs(rankGap)} place${Math.abs(rankGap) === 1 ? "" : "s"} ${
                rankGap > 0 ? "better" : "worse"
              } picking the real bracket round by round (#${card.liveRank}) than in the tournament it locked in before kickoff (#${card.lockedRank}).`}
        </p>
      ) : (
        !hasLive && (
          <p className="mt-3 max-w-3xl text-sm text-zinc-400">
            No round-by-round picks for this model — it stands on the tournament it locked in
            before the opening kickoff.
          </p>
        )
      )}

      <p className="mt-2 max-w-3xl text-xs text-zinc-600">
        Two separate benchmarks. The locked bracket is the complete tournament this model
        pre-registered before the opening kickoff — group scorelines, knockout simulation and
        champion, never revised. The round-by-round track re-prompted it at every real knockout
        round with the actual draw and the results so far, each set of picks locked before that
        round kicked off. Cost is this model&apos;s total inference spend across every prompt it
        answered.
      </p>
    </section>
  );
}

// Headline word per trait, indexed by band [low (-1), middle (0), high (+1)].
const TRAIT_WORD: Record<TraitKey, [string, string, string]> = {
  goalsPerGame: ["Cagey", "Balanced", "Attacking"],
  drawRate: ["Decisive", "Average", "Draw-prone"],
  chalkIndex: ["Contrarian", "Mixed", "Chalk"],
  upsetRate: ["Backs favourites", "Even-handed", "Hunts upsets"],
};

// Sentence fragments: [low pole, high pole] for a leaning, and the matching
// superlatives for a field-extreme (rank 1 = highest value, rank N = lowest).
const TRAIT_CLAUSE: Record<TraitKey, [string, string]> = {
  goalsPerGame: ["cautious in front of goal", "high-scoring"],
  drawRate: ["slow to call a draw", "fond of a draw"],
  chalkIndex: ["a contrarian", "a chalk-merchant"],
  upsetRate: ["loyal to the favourites", "an upset-hunter"],
};
const TRAIT_SUPERLATIVE: Record<TraitKey, [string, string]> = {
  goalsPerGame: ["the most cautious model in the field", "the most attacking model in the field"],
  drawRate: ["the least draw-prone model in the field", "the most draw-prone model in the field"],
  chalkIndex: ["the most contrarian model in the field", "the most chalk-hugging model in the field"],
  upsetRate: ["the most favourite-loyal model in the field", "the most upset-hungry model in the field"],
};
const TRAIT_KEYS: TraitKey[] = ["goalsPerGame", "drawRate", "chalkIndex", "upsetRate"];

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** A one-line "character" read of the model from its most extreme traits. */
function characterLine(label: string, p: Personality): string {
  const superlatives: string[] = [];
  const leanings: string[] = [];
  for (const t of TRAIT_KEYS) {
    if (p.rank[t] === 1) superlatives.push(TRAIT_SUPERLATIVE[t][1]);
    else if (p.rank[t] === p.fieldSize) superlatives.push(TRAIT_SUPERLATIVE[t][0]);
    else {
      const band = traitBand(p.rank[t], p.fieldSize);
      if (band === 1) leanings.push(TRAIT_CLAUSE[t][1]);
      else if (band === -1) leanings.push(TRAIT_CLAUSE[t][0]);
    }
  }
  if (superlatives.length > 0) {
    const extra = leanings.length > 0 ? `, and ${leanings[0]}` : "";
    return `${label} is ${superlatives[0]}${extra}.`;
  }
  if (leanings.length === 0) {
    return `${label} sits close to the field average across the board — a steady, unopinionated forecaster.`;
  }
  return `${label} leans ${joinList(leanings.slice(0, 3))}.`;
}

/** One personality trait: a character word over its supporting number. */
function Trait({
  trait,
  band,
  detail,
}: {
  trait: TraitKey;
  band: -1 | 0 | 1;
  detail: React.ReactNode;
}) {
  const labels: Record<TraitKey, string> = {
    goalsPerGame: "Goals / game",
    drawRate: "Draws",
    chalkIndex: "Chalk vs contrarian",
    upsetRate: "Favourite bias",
  };
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {labels[trait]}
      </p>
      <p className={`mt-1 text-lg font-bold ${band === 0 ? "text-zinc-300" : "text-emerald-300"}`}>
        {TRAIT_WORD[trait][band + 1]}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">{detail}</p>
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
          <div className={PENDING_CARD}>no valid simulation</div>
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
  const personality = data.personalities.get(slug);
  const reportCard = reportCardFor(data, slug);
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
          <p className="text-lg font-semibold text-zinc-100">No valid predictions</p>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            This model could not produce a valid prediction set within the retry policy — every
            attempt is preserved in the published raw audit logs. It scores 0 on every match and
            stands on the leaderboard as a measured outcome: the task format itself defeated it.
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
            <Stat
              label="Rank"
              value={anyResults || realKnockoutExists ? `#${entry.rank}` : "—"}
            />
            <Stat label="Group pts" value={totals.points} />
            <Stat label="Bracket pts" value={bracket.total} />
            <Stat label="Exact" value={entry.exactCount} />
            <Stat
              label="Champion pick"
              value={
                entry.championPick ? (
                  <span className="block truncate" title={entry.championPick}>
                    <TeamLabel teams={teams} name={entry.championPick} />
                  </span>
                ) : (
                  <span className="text-sm font-normal italic text-zinc-500">
                    no valid bracket
                  </span>
                )
              }
            />
          </section>

          {/* How the whole tournament went: verdict, champion fate, both tracks */}
          {reportCard && <ReportCardSection card={reportCard} teams={teams} />}

          {/* Prediction personality — style of the locked group-stage calls */}
          {personality && (
            <section>
              <h2 className="mb-1 text-lg font-semibold text-zinc-100">Prediction personality</h2>
              <p className="mb-4 max-w-3xl text-sm text-zinc-400">{characterLine(model.label, personality)}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Trait
                  trait="goalsPerGame"
                  band={traitBand(personality.rank.goalsPerGame, personality.fieldSize)}
                  detail={`${personality.goalsPerGame.toFixed(2)} goals per match`}
                />
                <Trait
                  trait="drawRate"
                  band={traitBand(personality.rank.drawRate, personality.fieldSize)}
                  detail={`${Math.round(personality.drawRate * personality.predicted)} of ${personality.predicted} called level`}
                />
                <Trait
                  trait="chalkIndex"
                  band={traitBand(personality.rank.chalkIndex, personality.fieldSize)}
                  detail={`sides with ${pct(personality.chalkIndex)} of the field`}
                />
                <Trait
                  trait="upsetRate"
                  band={traitBand(personality.rank.upsetRate, personality.fieldSize)}
                  detail={
                    personality.favMatches > 0
                      ? `${personality.upsetPicks} of ${personality.favMatches} favourite matchups called as upsets`
                      : "no clear-favourite matchups"
                  }
                />
              </div>
              <p className="mt-2 max-w-3xl text-xs text-zinc-600">
                Style, not accuracy — derived from this model&apos;s {personality.predicted} locked
                group-stage scorelines and compared with the other {personality.fieldSize - 1}{" "}
                models; it says nothing about whether the calls are right. &ldquo;Chalk&rdquo; is how
                often it agreed with the rest of the field; a &ldquo;favourite&rdquo; is the side the
                field collectively rates higher (mean predicted goal difference ≥ {0.5}), not a
                bookmaker&apos;s.
              </p>
            </section>
          )}

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
                    " Remaining rounds failed validation within the retry policy — rounds answered (and what they determine) still count."}
                </p>
                {/* The tree is wider than any phone; a right-edge fade signals
                    that the container scrolls (hidden at xl, where it fits). */}
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-linear-to-l from-zinc-950 to-transparent xl:hidden"
                  />
                  <div className="overflow-x-auto pb-2 pr-4">
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
                          <div className={PENDING_CARD}>no champion — bracket incomplete</div>
                        )}
                        <div>
                          <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                            Third-place match
                          </p>
                          {thirdMatches ? (
                            thirdMatches.map((m) => <SimCard key={m.match} m={m} teams={teams} />)
                          ) : (
                            <div className={PENDING_CARD}>no valid simulation</div>
                          )}
                        </div>
                      </StageColumn>
                    </div>
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
