import type { Fixture, MatchResult, StageId, Team } from "./types";
import { STAGE_LABELS, roundLabel } from "./types";
import { isKnockout } from "./scoring";
import type { TableRow } from "./standings";

export const PROMPT_VERSION = "v1";

/**
 * One prompt per stage, byte-identical for every model (D4). No model names,
 * no squad/injury/odds context — training knowledge only. Knockout prompts add
 * the actual tournament results so far (same context for everyone).
 */
export function buildPrompt(
  stage: StageId,
  fixtures: Fixture[],
  context?: {
    groupTables?: Map<string, TableRow[]>;
    knockoutResults?: { fixture: Fixture; result: MatchResult }[];
    /**
     * "simulated": the knockout context is the model's OWN predicted tournament
     * (self-consistent bracket simulation) — wording must not claim reality.
     */
    mode?: "real" | "simulated";
  },
): string {
  const knockout = isKnockout(stage);
  const lines: string[] = [];

  lines.push(
    "PunditBench — a public benchmark in which language models predict football match results for the 2026 FIFA World Cup (48 teams, USA/Canada/Mexico).",
    "",
    `Your task: predict the result of every ${STAGE_LABELS[stage].toLowerCase()} match listed at the end of this prompt.`,
    "",
    "Output rules (strict):",
    "- Respond with ONLY one JSON object. No markdown fences, no explanations, no other text.",
  );

  if (knockout) {
    lines.push(
      '- Format: {"predictions":[{"match":74,"home_goals":2,"away_goals":1,"advances":"<team name exactly as listed>"},...]}',
      "- home_goals/away_goals: integers 0-15, the score after 90 minutes plus stoppage time (a draw is possible — extra time and penalties come after).",
      '- "advances" is required for every match: the team that progresses to the next round (after extra time/penalties if your predicted 90-minute score is a draw). If your predicted score is not a draw, "advances" must be the winning team.',
      "- Exactly one entry per listed match number.",
    );
  } else {
    lines.push(
      '- Format: {"predictions":[{"match":1,"home_goals":2,"away_goals":0},...]}',
      "- home_goals/away_goals: integers 0-15, the final score after 90 minutes plus stoppage time (draws are possible in the group stage).",
      "- Exactly one entry per listed match number — all of them.",
    );
  }

  lines.push(
    "",
    "Scoring (identical for all participants): exact score = 3 points; correct goal difference = 2; correct outcome (win/draw/loss) = 1" +
      (knockout ? "; correctly naming the advancing team = +1." : "."),
  );

  if (knockout && context) {
    lines.push(
      "",
      context.mode === "simulated"
        ? "You previously predicted every group-stage match of this tournament. The fixtures below are the knockout bracket that follows from YOUR OWN predictions. Your predicted tournament so far:"
        : "Actual tournament results so far:",
    );
    if (context.groupTables && context.groupTables.size > 0) {
      lines.push("", "Final group tables (Team: points, goal difference, goals for):");
      for (const [group, table] of [...context.groupTables.entries()].sort()) {
        const row = table
          .map((t, i) => `${i + 1}. ${t.team} ${t.points}p ${t.gd >= 0 ? "+" + t.gd : t.gd} ${t.gf}gf`)
          .join("; ");
        lines.push(`Group ${group}: ${row}`);
      }
    }
    if (context.knockoutResults && context.knockoutResults.length > 0) {
      lines.push(
        "",
        context.mode === "simulated"
          ? "Your predicted knockout results so far (90-minute score; advancing team in brackets):"
          : "Knockout results so far (90-minute score; advancing team in brackets):",
      );
      for (const { fixture, result } of context.knockoutResults) {
        if (result.status !== "final") continue;
        const extra = result.note ? `, ${result.note}` : "";
        lines.push(
          `${roundLabel(fixture.stage)}: ${fixture.home} ${result.home_goals}-${result.away_goals} ${fixture.away} [${result.advances}${extra}]`,
        );
      }
    }
  }

  lines.push(
    "",
    knockout
      ? "Matches to predict (match number | home vs away | date | city):"
      : "Matches to predict (match number | group | home vs away | date | city):",
  );
  for (const f of fixtures) {
    const date = f.kickoff_utc.slice(0, 10);
    lines.push(
      knockout
        ? `${f.match} | ${f.home} vs ${f.away} | ${date} | ${f.city}`
        : `${f.match} | ${f.group} | ${f.home} vs ${f.away} | ${date} | ${f.city}`,
    );
  }

  return lines.join("\n");
}

export function modelSlug(openrouterId: string): string {
  return openrouterId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Flag emoji from ISO code; GB-ENG/GB-SCT/GB-WLS get tag-sequence flags. */
export function flagEmoji(iso2: string): string {
  const special: Record<string, string> = {
    "GB-ENG": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    "GB-SCT": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
    "GB-WLS": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
  };
  if (special[iso2]) return special[iso2];
  if (!/^[A-Za-z]{2}$/.test(iso2)) return "";
  const codePoints = [...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

export function teamFlag(teams: Team[], name: string): string {
  const t = teams.find((t) => t.name === name);
  return t ? flagEmoji(t.iso2) : "";
}
