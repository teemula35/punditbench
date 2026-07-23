/**
 * Pre-season final-table track (the "locked" league benchmark): before a
 * competition's opener every roster model predicts the FINAL league table
 * from one deterministic prompt; the stored tables are hashed for
 * pre-registration and graded live as the season progresses ("if the season
 * ended today" against the current standings, final grading against the real
 * final table). Prompt building, validation, scoring, IO and the canonical
 * hash form all live here — scripts/season-predict.ts is the runner.
 */
import fs from "node:fs";
import path from "node:path";
import type { PreseasonContext, PreviousSeason } from "./league-context";
import type { Competition } from "./types";
import { extractJson } from "./validate";

// v2 adds the optional summer transfer/injury/manager block after the
// previous-season table. v1 (no such block) was never run, so no stored
// artifacts carry it.
export const SEASON_PROMPT_VERSION = "season-v2";

/** One model's stored season-table prediction (data/competitions/<id>/predictions-season/<slug>.json). */
export interface SeasonPredictionFile {
  model: string; // OpenRouter id
  slug: string;
  competition: string; // competition id, e.g. "epl-2026-27"
  kind: "season-table";
  prompt_version: string;
  /** Params actually used (after any compatibility fallbacks). */
  params: Record<string, unknown>;
  requested_at: string; // ISO — when the successful attempt was sent
  completed_at: string; // ISO — when the successful attempt returned (golden-rule timestamp)
  attempts: number;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost_usd?: number };
  /** Predicted final table, champion first. */
  table: string[];
}

/**
 * One prompt per competition, byte-identical for every model: content derives
 * ONLY from the arguments — no clock, no randomness, no model names. The
 * previous-season section carries the final table and promoted teams when
 * available; the pre-season context section carries confirmed summer transfers,
 * injuries and managerial changes as of a compiled date. PreviousSeason.note and
 * PreseasonContext.source are file provenance for auditors and are never
 * rendered.
 */
export function buildSeasonPrompt(
  comp: Competition,
  teams: string[],
  previousSeason?: PreviousSeason,
  preseason?: PreseasonContext,
): string {
  const lines: string[] = [];

  lines.push(
    `PunditBench — a public benchmark in which language models predict football match results for the ${comp.name} season.`,
    "",
    `Your task: predict the FINAL league table for the whole ${comp.name} season, best to worst.`,
    "",
    "Output rules (strict):",
    "- Respond with ONLY one JSON object. No markdown fences, no explanations, no other text.",
    '- Format: {"table":["Team 1","Team 2",...]} — position 1 (champion) first, last place last.',
    "- List every team from the team list below exactly once, spelled exactly as in the list provided. No omissions, no duplicates, no other teams.",
    "",
    "Scoring (identical for all participants): exact position = 2 points; one position off = 1; correct champion = +5; each correct top-4 team (any order) = +2; each correct relegated team (any order) = +2.",
  );

  if (previousSeason) {
    lines.push("", `Previous season (${previousSeason.season}) final table:`);
    previousSeason.table.forEach((team, i) => lines.push(`${i + 1}. ${team}`));
    if (previousSeason.promoted.length > 0) {
      lines.push(`Promoted this season: ${previousSeason.promoted.join(", ")}.`);
    }
    // previousSeason.note is file provenance for auditors — never model-facing.
  }

  // Summer transfers + injuries + managerial changes, when compiled. Only
  // sub-lists with content are rendered, and the whole block is skipped if all
  // are empty, so an as-yet-unpopulated file never emits a bare header. source
  // is never rendered (managers is optional).
  if (
    preseason &&
    (preseason.transfers.length > 0 ||
      preseason.injuries.length > 0 ||
      (preseason.managers?.length ?? 0) > 0)
  ) {
    lines.push(
      "",
      `Summer 2026 squad changes, injuries and managerial changes (confirmed as of ${preseason.as_of}) — the latest available information:`,
    );
    if (preseason.transfers.length > 0) {
      lines.push("Transfers:", ...preseason.transfers.map((t) => `- ${t}`));
    }
    if (preseason.injuries.length > 0) {
      lines.push("Injuries and unavailable players:", ...preseason.injuries.map((i) => `- ${i}`));
    }
    if (preseason.managers?.length) {
      lines.push("Managerial changes:", ...preseason.managers.map((m) => `- ${m}`));
    }
  }

  const sorted = [...teams].sort((a, b) => a.localeCompare(b));
  lines.push("", "Teams (predict all of them):", ...sorted);

  return lines.join("\n");
}

/**
 * Strict season-table validation: the response must contain a "table" array of
 * strings that is exactly a permutation of `teams` — every team once, exact
 * spelling, no extras, no fuzzy matching. Error messages name the offending
 * team ("missing: X", "duplicate: Y", "unknown: Z") so the retry prompt can
 * feed them straight back to the model.
 */
export function validateSeasonTable(
  raw: string,
  teams: string[],
): { ok: boolean; errors: string[]; table: string[] } {
  const errors: string[] = [];
  const parsed = extractJson(raw);
  if (parsed === undefined || typeof parsed !== "object" || parsed === null) {
    return { ok: false, errors: ["Response is not parseable JSON."], table: [] };
  }
  const list = (parsed as { table?: unknown }).table;
  if (!Array.isArray(list)) {
    return { ok: false, errors: ['Top-level key "table" missing or not an array.'], table: [] };
  }

  const teamSet = new Set(teams);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") {
      errors.push(`Entry ${JSON.stringify(item)} is not a string.`);
      continue;
    }
    if (!teamSet.has(item)) {
      errors.push(`unknown: ${item} (not in the team list — use the exact spelling provided)`);
      continue;
    }
    if (seen.has(item)) {
      errors.push(`duplicate: ${item} (listed more than once)`);
      continue;
    }
    seen.add(item);
    out.push(item);
  }
  for (const team of teams) {
    if (!seen.has(team)) errors.push(`missing: ${team}`);
  }
  if (list.length !== teams.length) {
    errors.push(`Table has ${list.length} entries; expected exactly ${teams.length}.`);
  }
  return { ok: errors.length === 0, errors, table: errors.length === 0 ? out : [] };
}

export interface SeasonScore {
  total: number;
  exact: number;
  offByOne: number;
  champion: boolean;
  topFourHits: number;
  relegationHits: number;
}

/**
 * Score a predicted final table against an actual ordering: exact position =
 * 2 points; exactly one position off = 1 (exclusive with exact); correct
 * champion = +5; each correct top-4 team (any order) = +2; each correct
 * relegated team (any order) = +2.
 *
 * The relegation zone is the DIRECT relegation spots of the five covered
 * leagues, derived from actual.length: 20-team tables (Premier League,
 * La Liga, Serie A) relegate the bottom 3 automatically; 18-team tables
 * (Bundesliga, Ligue 1) relegate only the bottom 2 automatically — 16th place
 * enters a relegation play-off, which is not a guaranteed relegation, so it
 * does not count as a spot.
 *
 * `actual` may also be the CURRENT standings order mid-season ("if the season
 * ended today") — the function is the same; partial-season semantics are the
 * caller's.
 */
export function scoreSeasonTable(predicted: string[], actual: string[]): SeasonScore {
  const actualIndex = new Map(actual.map((team, i) => [team, i]));
  let exact = 0;
  let offByOne = 0;
  predicted.forEach((team, i) => {
    const ai = actualIndex.get(team);
    if (ai === undefined) return;
    const diff = Math.abs(ai - i);
    if (diff === 0) exact++;
    else if (diff === 1) offByOne++;
  });

  const champion = predicted[0] !== undefined && predicted[0] === actual[0];

  const actualTopFour = new Set(actual.slice(0, 4));
  const topFourHits = predicted.slice(0, 4).filter((t) => actualTopFour.has(t)).length;

  const relegationSpots = actual.length >= 20 ? 3 : 2;
  const actualRelegated = new Set(actual.slice(-relegationSpots));
  const relegationHits = predicted.slice(-relegationSpots).filter((t) => actualRelegated.has(t)).length;

  const total = 2 * exact + offByOne + (champion ? 5 : 0) + 2 * topFourHits + 2 * relegationHits;
  return { total, exact, offByOne, champion, topFourHits, relegationHits };
}

/**
 * All stored season-table predictions for one competition
 * (data/competitions/<id>/predictions-season/*.json), [] when none. Resolves
 * process.cwd() per call so tests can point it at a temporary tree.
 */
export function loadSeasonPredictions(compId: string): SeasonPredictionFile[] {
  const dir = path.join(process.cwd(), "data", "competitions", compId, "predictions-season");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as SeasonPredictionFile);
}

/**
 * Canonical form for the season track: JSON array of {slug, model,
 * competition, completed_at, table} sorted by slug, no whitespace. Table order
 * is the prediction, so it is kept exactly as stored; volatile fields
 * (params, usage, attempts) are excluded, like lib/hashing.ts canonicalPayload.
 */
export function seasonCanonicalPayload(files: SeasonPredictionFile[]): string {
  const canonical = [...files]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((f) => ({
      slug: f.slug,
      model: f.model,
      competition: f.competition,
      completed_at: f.completed_at,
      table: f.table,
    }));
  return JSON.stringify(canonical);
}
