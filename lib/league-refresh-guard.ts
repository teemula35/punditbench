import fs from "node:fs";
import path from "node:path";

export interface FixtureGuardTarget {
  comp: { id: string };
}

export interface FixtureGuardResult<T extends FixtureGuardTarget> {
  allowed: T[];
  blocked: T[];
  error?: string;
}

export interface CompetitionRefreshOutcome {
  ok: boolean;
  clean: boolean;
}

export interface RefreshBatchResult {
  ok: boolean;
  cleanCompetitionIds: string[];
  errors: string[];
}

const COMPETITION_ID = /^[a-z0-9][a-z0-9-]*$/;
const RUN_TOKEN = /^[A-Za-z0-9_-]+$/;

type AttestationEnv = Readonly<Record<string, string | undefined>>;

/** Run-scoped handoff path shared by sequential steps on one GitHub-hosted runner. */
export function fixtureAttestationPath(env: AttestationEnv = process.env): string | undefined {
  const runnerTemp = env.RUNNER_TEMP;
  const runId = env.GITHUB_RUN_ID;
  const attempt = env.GITHUB_RUN_ATTEMPT ?? "1";
  if (!runnerTemp || !runId || !RUN_TOKEN.test(runId) || !RUN_TOKEN.test(attempt)) return undefined;
  return path.join(runnerTemp, `punditbench-fixture-clean-${runId}-${attempt}.json`);
}

/** Stable single-line value written to GitHub Actions output. */
export function encodeCleanCompetitions(ids: string[]): string {
  return JSON.stringify([...new Set(ids)].sort());
}

/** Atomically publish the refresher's same-run allowlist for the prediction step. */
export function writeCleanCompetitionAttestation(
  ids: string[],
  env: AttestationEnv = process.env,
): boolean {
  const destination = fixtureAttestationPath(env);
  if (!destination) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${encodeCleanCompetitions(ids)}\n`, "utf-8");
  fs.renameSync(temporary, destination);
  return true;
}

/** Explicit local input wins; Actions otherwise reads its unique run-scoped handoff. */
export function loadCleanCompetitionAttestation(
  env: AttestationEnv = process.env,
): string | undefined {
  if (env.PB_LEAGUE_FIXTURE_CLEAN_COMPETITIONS !== undefined) {
    return env.PB_LEAGUE_FIXTURE_CLEAN_COMPETITIONS;
  }
  const source = fixtureAttestationPath(env);
  if (!source) return undefined;
  try {
    return fs.readFileSync(source, "utf-8").trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/** Run every competition independently so one fetch failure cannot hide later clean checks. */
export async function runRefreshBatch<T extends { id: string }>(
  competitions: T[],
  refresh: (competition: T) => Promise<CompetitionRefreshOutcome>,
): Promise<RefreshBatchResult> {
  const cleanCompetitionIds: string[] = [];
  const errors: string[] = [];
  for (const competition of competitions) {
    try {
      const outcome = await refresh(competition);
      if (outcome.ok && outcome.clean) cleanCompetitionIds.push(competition.id);
      if (!outcome.ok) errors.push(`${competition.id}: fixture refresh reported an unsafe state`);
    } catch (error) {
      errors.push(`${competition.id}: ${(error as Error).message}`);
    }
  }
  return {
    ok: errors.length === 0,
    cleanCompetitionIds: [...new Set(cleanCompetitionIds)].sort(),
    errors,
  };
}

function parseAttestation(raw: string | undefined): Set<string> {
  if (!raw) throw new Error("fixture-clean attestation is missing");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("fixture-clean attestation is not valid JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("fixture-clean attestation must be a JSON array");
  const clean = new Set<string>();
  for (const id of parsed) {
    if (typeof id !== "string" || !COMPETITION_ID.test(id)) {
      throw new Error("fixture-clean attestation contains an invalid competition id");
    }
    if (clean.has(id)) throw new Error("fixture-clean attestation contains a duplicate id");
    clean.add(id);
  }
  return clean;
}

/**
 * Mutation-capable due runs are allowed only for competitions positively
 * attested by the fixture refresh in this same workflow run.
 */
export function guardDueTargets<T extends FixtureGuardTarget>(
  targets: T[],
  rawAttestation: string | undefined,
): FixtureGuardResult<T> {
  let clean: Set<string>;
  try {
    clean = parseAttestation(rawAttestation);
  } catch (error) {
    return {
      allowed: [],
      blocked: [...targets],
      error: (error as Error).message,
    };
  }
  return {
    allowed: targets.filter((target) => clean.has(target.comp.id)),
    blocked: targets.filter((target) => !clean.has(target.comp.id)),
  };
}
