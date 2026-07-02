import type { Competition, Fixture, MatchdayKey } from "./types";
import { roundLabel } from "./types";
import type { TableRow } from "./standings";
import type { PreviousSeason } from "./league-context";

export const LEAGUE_PROMPT_VERSION = "league-v1";

/**
 * One prompt per matchday, byte-identical for every model: content derives
 * ONLY from the arguments — no clock, no randomness, no model names. Unlike
 * the knowledge-only WC prompts, league prompts are form-aware: they carry the
 * current table and recent form built deterministically from our synced
 * results at lock time, so every model reasons over the same shared evidence.
 * Matchdays are never knockout rounds — draws stand, so there is no
 * "advances" field and no advancer bonus.
 */
export function buildLeaguePrompt(
  comp: Competition,
  round: MatchdayKey,
  fixtures: Fixture[],
  context: { table: TableRow[]; form: Map<string, string[]>; previousSeason?: PreviousSeason },
): string {
  const lines: string[] = [];

  lines.push(
    `PunditBench — a public benchmark in which language models predict football match results for the ${comp.name} season.`,
    "",
    `Your task: predict the result of every ${roundLabel(round)} match listed at the end of this prompt.`,
    "",
    "Output rules (strict):",
    "- Respond with ONLY one JSON object. No markdown fences, no explanations, no other text.",
    '- Format: {"predictions":[{"match":1,"home_goals":2,"away_goals":0},...]}',
    "- home_goals/away_goals: integers 0-15, the final score after 90 minutes plus stoppage time (draws are possible in league play).",
    "- Exactly one entry per listed match number — all of them.",
    "",
    "Scoring (identical for all participants): exact score = 3 points; correct goal difference = 2; correct outcome (win/draw/loss) = 1.",
  );

  const started = context.table.some((r) => r.played > 0);
  if (started) {
    lines.push("", "Current league table (Pos. Team — P W D L GF-GA GD Pts):");
    context.table.forEach((r, i) => {
      const gd = r.gd >= 0 ? `+${r.gd}` : String(r.gd);
      lines.push(
        `${i + 1}. ${r.team} — P${r.played} W${r.won} D${r.drawn} L${r.lost} ${r.gf}-${r.ga} ${gd} ${r.points}`,
      );
    });
  } else if (context.previousSeason) {
    // Season not started (every row played 0): previous season stands in for the table.
    const prev = context.previousSeason;
    lines.push("", `Previous season (${prev.season}) final table:`);
    prev.table.forEach((team, i) => lines.push(`${i + 1}. ${team}`));
    if (prev.promoted.length > 0) lines.push(`Promoted this season: ${prev.promoted.join(", ")}.`);
    // prev.note is file provenance for auditors — never model-facing.
  }

  // Form, ordered by table position (alphabetical when no table is shown);
  // teams with no finished matches are omitted entirely.
  const order = started
    ? context.table.map((r) => r.team)
    : [...context.form.keys()].sort((a, b) => a.localeCompare(b));
  const ordered = new Set(order);
  const extras = [...context.form.keys()].filter((t) => !ordered.has(t)).sort((a, b) => a.localeCompare(b));
  const formLines: string[] = [];
  for (const team of [...order, ...extras]) {
    const entries = context.form.get(team);
    if (entries && entries.length > 0) formLines.push(`${team}: ${entries.join(" | ")}`);
  }
  if (formLines.length > 0) lines.push("", "Recent form (most recent first):", ...formLines);

  lines.push("", "Matches to predict (match number | home vs away | date | city):");
  for (const f of fixtures) {
    // League ingest can leave city "" (ESPN venue without a city) — drop the
    // trailing segment rather than end the line with an empty "| ".
    const base = `${f.match} | ${f.home} vs ${f.away} | ${f.kickoff_utc.slice(0, 10)}`;
    lines.push(f.city ? `${base} | ${f.city}` : base);
  }

  return lines.join("\n");
}
