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

export interface Team {
  name: string;
  code: string; // FIFA trigram, e.g. "RSA"
  iso2: string; // ISO 3166-1 alpha-2 (or GB-ENG style) for flag emoji
  group: string; // "A".."L"
}

export interface Fixture {
  match: number; // official FIFA match number 1..104
  stage: StageId;
  group?: string; // group stage only
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
  stage: StageId;
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
  perStage: Partial<Record<StageId, number>>;
}
