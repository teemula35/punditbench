export type StageId = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final";

export const KNOCKOUT_STAGES: StageId[] = ["r32", "r16", "qf", "sf", "third", "final"];

export const STAGE_LABELS: Record<StageId, string> = {
  group: "Group stage",
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  third: "Third-place match",
  final: "Final",
};

/**
 * League matchday key, e.g. "md01".."md38". Together with the WC StageId this
 * forms RoundKey — the general "which round" discriminator. Matchday rounds are
 * never knockout rounds: draws stand and `advances` never applies.
 */
export type MatchdayKey = `md${number}`;

export type RoundKey = StageId | MatchdayKey;

export function isMatchdayKey(key: string): key is MatchdayKey {
  return /^md\d+$/.test(key);
}

/** Zero-padded matchday key for round N (1 -> "md01"); pads to 2 so keys sort lexicographically. */
export function mdKey(round: number): MatchdayKey {
  return `md${String(round).padStart(2, "0")}` as MatchdayKey;
}

/** Matchday number from a round key ("md07" -> 7); undefined for WC stages. */
export function matchdayNumber(key: RoundKey): number | undefined {
  const m = /^md(\d+)$/.exec(key);
  return m ? Number(m[1]) : undefined;
}

/** Human label for any round key: WC stages via STAGE_LABELS, matchdays as "Matchday N". */
export function roundLabel(key: RoundKey): string {
  const md = matchdayNumber(key);
  return md !== undefined ? `Matchday ${md}` : STAGE_LABELS[key as StageId];
}

/** One competition covered by the benchmark (data/competitions.json). */
export interface Competition {
  /** Kebab id, also the directory name under data/competitions/, e.g. "epl-2026-27". */
  id: string;
  kind: "league"; // future: "league-phase" (UCL) etc.
  name: string; // "Premier League 2026-27"
  short_name: string; // "Premier League"
  season_label: string; // "2026-27"
  espn_slug: string; // ESPN soccer league code, e.g. "eng.1"
  team_count: number;
  round_count: number; // matchdays in a full season
  /** Only active competitions are processed by results-sync and the predict scheduler. */
  active: boolean;
  notes?: string;
}

export interface Team {
  name: string;
  code: string; // FIFA trigram, e.g. "RSA"
  iso2: string; // ISO 3166-1 alpha-2 (or GB-ENG style) for flag emoji
  group: string; // "A".."L"
}

export interface Fixture {
  match: number; // unique within its competition (WC: official FIFA match number 1..104)
  stage: RoundKey;
  group?: string; // WC group stage only
  round?: number; // league matchday number (mirrors stage "mdNN")
  espn_id?: string; // ESPN event id — league fixtures are ingested from ESPN; results match by this id
  home: string; // team name; knockout fixtures resolved from slots
  away: string;
  kickoff_local?: string;
  tz?: string;
  kickoff_utc: string; // ISO 8601
  city: string;
  stadium?: string;
  time_unverified?: boolean;
}

export interface KnockoutSlot {
  match: number; // 73..104
  stage: StageId;
  home_slot: string; // e.g. "1A", "3C/D/F/G/H", "W74"
  away_slot: string;
  kickoff_local?: string;
  tz?: string;
  kickoff_utc: string;
  city: string;
  stadium?: string;
}

export interface RosterModel {
  id: string; // OpenRouter id, e.g. "openai/gpt-..."
  label: string;
  vendor: string;
  tier: "flagship" | "mid" | "small" | "legacy" | "oddball";
  context_length?: number;
  pricing_prompt_usd_per_m?: number;
  pricing_completion_usd_per_m?: number;
  knowledge_cutoff?: string;
  reasoning?: boolean;
  notes?: string;
}

export interface Prediction {
  match: number;
  home_goals: number;
  away_goals: number;
  /** Knockout only: team name that the model says advances. */
  advances?: string;
}

/** One model's stored predictions for one stage (data/predictions/<stage>/<slug>.json). */
export interface PredictionFile {
  model: string; // OpenRouter id
  slug: string;
  stage: RoundKey;
  prompt_version: string;
  /** Params actually used (after any compatibility fallbacks). */
  params: Record<string, unknown>;
  requested_at: string; // ISO — when the successful attempt was sent
  completed_at: string; // ISO — when the successful attempt returned (golden-rule timestamp)
  attempts: number;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost_usd?: number };
  /**
   * Knockout simulation only: the model's OWN bracket pairings these
   * predictions refer to (match numbers are structural bracket slots 73-104,
   * teams come from the model's simulated tournament, not reality).
   */
  simulated_fixtures?: { match: number; home: string; away: string }[];
  predictions: Prediction[];
}

export interface MatchResult {
  match: number;
  status: "final" | "voided";
  /** Score after 90 minutes + stoppage (the scored result). */
  home_goals?: number;
  away_goals?: number;
  /** Knockout only: team that progressed (after ET/pens if needed). */
  advances?: string;
  /** Display only, e.g. "2–1 a.e.t." or "pens 4–2". */
  note?: string;
}

export type Breakdown = "exact" | "gd" | "outcome" | "none" | "missing";

export interface MatchScore {
  match: number;
  points: number; // includes advance bonus
  breakdown: Breakdown;
  advance_bonus: 0 | 1;
}

export interface ModelTotals {
  slug: string;
  points: number;
  exact: number;
  gd: number;
  outcome: number;
  advances: number;
  scoredMatches: number; // finished, non-voided matches the model was scored on
  matchesWithPoints: number;
  perStage: Partial<Record<RoundKey, number>>;
}

/**
 * Round-by-round ("live") track manifest — data/predictions-live/manifest.json.
 * The live track is the separate benchmark in which every model predicts the
 * REAL knockout pairings round by round (direct scoring), as opposed to the
 * locked self-consistent bracket. `excluded` records knockout matches that had
 * already kicked off when a round's live picks were collected, so they carry no
 * pre-registered live prediction (shown as "not pre-registered" on the site).
 */
export interface LiveManifest {
  /** match number (string key) -> human reason it has no live picks. */
  excluded: Record<string, string>;
  /** per-round lock metadata, for the "pre-registered before kickoff" copy. */
  rounds: Partial<Record<RoundKey, { locked_at: string; models: number; excluded: number[] }>>;
}
