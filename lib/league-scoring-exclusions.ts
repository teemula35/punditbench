import type {
  Fixture,
  LiveManifest,
  PostLockScoringExclusion,
  ScoringExclusionsFile,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validate an additive scoring classification against current operational data.
 * Invalid or stale records fail closed rather than silently changing scoring.
 */
export function validateScoringExclusions(
  raw: unknown,
  fixtures: Fixture[],
  manifest: LiveManifest,
): PostLockScoringExclusion[] {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.exclusions)) {
    throw new Error("Unsupported scoring-exclusions version or shape");
  }

  const byMatch = new Map(fixtures.map((fixture) => [fixture.match, fixture]));
  const seenMatches = new Set<number>();
  const seenEspnIds = new Set<string>();
  const exclusions: PostLockScoringExclusion[] = [];

  for (const candidate of raw.exclusions) {
    if (!isRecord(candidate)) throw new Error("Invalid scoring exclusion entry");
    const locked = candidate.locked_fixture;
    if (
      !Number.isInteger(candidate.match) ||
      !nonEmptyString(candidate.espn_id) ||
      candidate.classification !== "post_lock_home_away_reversal" ||
      !isRecord(locked) ||
      !nonEmptyString(locked.home) ||
      !nonEmptyString(locked.away) ||
      !nonEmptyString(locked.city) ||
      (locked.stadium !== undefined && !nonEmptyString(locked.stadium)) ||
      !nonEmptyString(candidate.reason) ||
      !nonEmptyString(candidate.decided_at) ||
      !Number.isFinite(Date.parse(candidate.decided_at))
    ) {
      throw new Error("Invalid scoring exclusion entry fields");
    }

    const match = candidate.match as number;
    const espnId = candidate.espn_id;
    if (seenMatches.has(match) || seenEspnIds.has(espnId)) {
      throw new Error(`Duplicate scoring exclusion identity for match ${match}`);
    }
    seenMatches.add(match);
    seenEspnIds.add(espnId);

    const fixture = byMatch.get(match);
    if (!fixture) throw new Error(`Scoring exclusion references missing match ${match}`);
    if (fixture.espn_id !== espnId) {
      throw new Error(`Scoring exclusion ESPN id mismatch for match ${match}`);
    }
    if (!manifest.rounds[fixture.stage]) {
      throw new Error(`Scoring exclusion match ${match} is not in a locked round`);
    }
    if (String(match) in manifest.excluded) {
      throw new Error(`Scoring exclusion match ${match} overlaps manifest exclusion`);
    }
    if (fixture.home !== locked.away || fixture.away !== locked.home) {
      throw new Error(`Scoring exclusion match ${match} is not the reverse of the locked fixture`);
    }

    exclusions.push(candidate as unknown as PostLockScoringExclusion);
  }

  return exclusions;
}

/** Compile-time documentation of the accepted on-disk schema. */
export type { ScoringExclusionsFile };
