import type { Fixture, Prediction } from "./types";
import { isKnockout } from "./scoring";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** Tolerated oddities, e.g. extra entries for unlisted match numbers (dropped). */
  warnings: string[];
  predictions: Prediction[];
}

/** Tolerantly extract a JSON object from raw model output (fences, prose around it). */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const direct = tryParse(trimmed);
  if (direct !== undefined) return direct;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    const fenced = tryParse(fence[1].trim());
    if (fenced !== undefined) return fenced;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const sliced = tryParse(trimmed.slice(start, end + 1));
    if (sliced !== undefined) return sliced;
  }
  return undefined;
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/**
 * Strict validation per D4/D5: every fixture exactly once, integer goals 0–15,
 * knockout `advances` must be one of the two teams and consistent with a
 * non-draw scoreline (and mandatory on a predicted draw).
 */
export function validatePredictions(raw: string, fixtures: Fixture[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = extractJson(raw);
  if (parsed === undefined || typeof parsed !== "object" || parsed === null) {
    return { ok: false, errors: ["Response is not parseable JSON."], warnings, predictions: [] };
  }
  const list = (parsed as { predictions?: unknown }).predictions;
  if (!Array.isArray(list)) {
    return { ok: false, errors: ['Top-level key "predictions" missing or not an array.'], warnings, predictions: [] };
  }

  const byMatch = new Map<number, Fixture>(fixtures.map((f) => [f.match, f]));
  const seen = new Set<number>();
  const out: Prediction[] = [];

  for (const item of list) {
    if (typeof item !== "object" || item === null) {
      errors.push(`Entry ${JSON.stringify(item)} is not an object.`);
      continue;
    }
    const e = item as Record<string, unknown>;
    const match = e.match;
    if (typeof match !== "number") {
      errors.push(`Missing or non-numeric match number: ${JSON.stringify(match)}.`);
      continue;
    }
    if (!byMatch.has(match)) {
      // Some models keep predicting past the listed fixtures (e.g. into the
      // knockout bracket). Extra entries are noise, not a football error — drop
      // them with a warning; coverage of the listed fixtures stays mandatory.
      warnings.push(`Entry for unlisted match number ${match} ignored.`);
      continue;
    }
    if (seen.has(match)) {
      errors.push(`Match ${match} predicted more than once.`);
      continue;
    }
    const fixture = byMatch.get(match)!;
    const hg = e.home_goals;
    const ag = e.away_goals;
    if (!isValidGoals(hg) || !isValidGoals(ag)) {
      errors.push(`Match ${match}: home_goals/away_goals must be integers 0-15 (got ${JSON.stringify(hg)}, ${JSON.stringify(ag)}).`);
      continue;
    }
    const p: Prediction = { match, home_goals: hg as number, away_goals: ag as number };

    if (isKnockout(fixture.stage)) {
      const adv = e.advances;
      if (adv !== undefined && adv !== fixture.home && adv !== fixture.away) {
        errors.push(`Match ${match}: "advances" must be exactly "${fixture.home}" or "${fixture.away}" (got ${JSON.stringify(adv)}).`);
        continue;
      }
      if (p.home_goals === p.away_goals && adv === undefined) {
        errors.push(`Match ${match}: predicted a draw after 90 minutes — "advances" is required.`);
        continue;
      }
      if (p.home_goals !== p.away_goals && adv !== undefined) {
        const winner = p.home_goals > p.away_goals ? fixture.home : fixture.away;
        if (adv !== winner) {
          errors.push(`Match ${match}: "advances" (${adv}) contradicts the predicted score ${p.home_goals}-${p.away_goals}.`);
          continue;
        }
      }
      if (adv !== undefined) p.advances = adv as string;
    }

    seen.add(match);
    out.push(p);
  }

  for (const f of fixtures) {
    if (!seen.has(f.match)) errors.push(`Match ${f.match} (${f.home} vs ${f.away}) is missing.`);
  }

  out.sort((a, b) => a.match - b.match);
  return { ok: errors.length === 0, errors, warnings, predictions: out };
}

function isValidGoals(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 15;
}
