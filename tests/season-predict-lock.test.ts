import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sha256 } from "../lib/hashing";
import {
  assertSeasonTrackUnlocked,
  seasonCanonicalPayload,
  verifySeasonHashLock,
} from "../lib/season-prediction";
import type { SeasonPredictionFile } from "../lib/season-prediction";

const REPO_ROOT = process.cwd();
const COMP_ID = "test-league";
const STORED: SeasonPredictionFile = {
  model: "test/model",
  slug: "test-model",
  competition: COMP_ID,
  kind: "season-table",
  prompt_version: "season-v2",
  params: {},
  requested_at: "2026-08-01T00:00:00Z",
  completed_at: "2026-08-01T00:00:01Z",
  attempts: 1,
  table: ["A", "B"],
};

function hashRecord(hash: string): string {
  return [
    "track: locked (pre-season final table)",
    `competition: ${COMP_ID}`,
    "models: 1",
    "generated_at: 2026-08-01T00:00:02.000Z",
    `sha256: ${hash}`,
    "",
  ].join("\n");
}

function runSeasonPredict(cwd: string, ...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(REPO_ROOT, "scripts", "season-predict.ts"),
      "--comp",
      COMP_ID,
      ...args,
    ],
    {
      cwd,
      encoding: "utf-8",
      env: { ...process.env, OPENROUTER_API_KEY: "" },
    },
  );
}

describe("season prediction lock", () => {
  let previousCwd: string;
  let tmp: string;
  let lockPath: string;

  beforeEach(() => {
    previousCwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "punditbench-season-lock-"));
    process.chdir(tmp);
    const dataDir = path.join(tmp, "data");
    const competitionDir = path.join(dataDir, "competitions", COMP_ID);
    fs.mkdirSync(competitionDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, "competitions.json"),
      JSON.stringify([
        {
          id: COMP_ID,
          kind: "league",
          name: "Test League 2026-27",
          short_name: "Test League",
          season_label: "2026-27",
          espn_slug: "test.1",
          team_count: 2,
          round_count: 1,
          active: false,
        },
      ]),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(dataDir, "roster-league.json"),
      JSON.stringify([{ id: "test/model", label: "Model", vendor: "Test", tier: "mid" }]),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(competitionDir, "fixtures.json"),
      JSON.stringify([
        {
          match: 1,
          stage: "md01",
          round: 1,
          home: "A",
          away: "B",
          kickoff_utc: "2026-08-10T12:00:00Z",
          city: "",
        },
      ]),
      "utf-8",
    );
    lockPath = path.join(competitionDir, "hashes", "season.txt");
  });

  afterEach(() => {
    process.chdir(previousCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("fails closed as soon as a season lock exists", () => {
    expect(() => assertSeasonTrackUnlocked(COMP_ID)).not.toThrow();
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, hashRecord("0".repeat(64)), "utf-8");

    expect(() => assertSeasonTrackUnlocked(COMP_ID)).toThrow(/already locked.*refusing.*backfill/i);
  });

  it("blocks --only-missing before any mock prediction or audit file can be written", () => {
    const record = hashRecord("0".repeat(64));
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, record, "utf-8");
    const mtime = fs.statSync(lockPath).mtimeMs;

    const result = runSeasonPredict(tmp, "--only-missing", "--mock");
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toMatch(/already locked.*refusing.*backfill/is);
    expect(fs.existsSync(path.join(tmp, "data", "competitions", COMP_ID, "predictions-season"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(tmp, "data", "competitions", COMP_ID, "raw-season"))).toBe(false);
    expect(fs.readFileSync(lockPath, "utf-8")).toBe(record);
    expect(fs.statSync(lockPath).mtimeMs).toBe(mtime);
  });

  it("keeps --dry-run usable and read-only after the season is locked", () => {
    const record = hashRecord("0".repeat(64));
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, record, "utf-8");
    const mtime = fs.statSync(lockPath).mtimeMs;

    const result = runSeasonPredict(tmp, "--dry-run");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--- dry run: test-league season table");
    expect(fs.existsSync(path.join(tmp, "data", "competitions", COMP_ID, "predictions-season"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(tmp, "data", "competitions", COMP_ID, "raw-season"))).toBe(false);
    expect(fs.readFileSync(lockPath, "utf-8")).toBe(record);
    expect(fs.statSync(lockPath).mtimeMs).toBe(mtime);
  });

  it("verifies a matching stored hash without rewriting the lock", () => {
    const predictionDir = path.join(tmp, "data", "competitions", COMP_ID, "predictions-season");
    fs.mkdirSync(predictionDir, { recursive: true });
    fs.writeFileSync(path.join(predictionDir, "test-model.json"), JSON.stringify(STORED), "utf-8");
    const hash = sha256(seasonCanonicalPayload([STORED]));
    const record = hashRecord(hash);
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, record, "utf-8");
    fs.utimesSync(lockPath, new Date("2026-08-01T00:00:03Z"), new Date("2026-08-01T00:00:03Z"));
    const mtime = fs.statSync(lockPath).mtimeMs;

    expect(verifySeasonHashLock(COMP_ID)).toEqual({ models: 1, hash });
    const result = runSeasonPredict(tmp, "--hash-only");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`verified sha256 ${hash} over 1 model file(s)`);
    expect(result.stdout).toContain("season.txt unchanged");
    expect(fs.readFileSync(lockPath, "utf-8")).toBe(record);
    expect(fs.statSync(lockPath).mtimeMs).toBe(mtime);
  });

  it("rejects a mismatch without rewriting the lock", () => {
    const predictionDir = path.join(tmp, "data", "competitions", COMP_ID, "predictions-season");
    fs.mkdirSync(predictionDir, { recursive: true });
    fs.writeFileSync(path.join(predictionDir, "test-model.json"), JSON.stringify(STORED), "utf-8");
    const record = hashRecord("0".repeat(64));
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, record, "utf-8");
    const mtime = fs.statSync(lockPath).mtimeMs;

    expect(() => verifySeasonHashLock(COMP_ID)).toThrow(/hash mismatch/i);
    const result = runSeasonPredict(tmp, "--hash-only");
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/hash mismatch/i);
    expect(fs.readFileSync(lockPath, "utf-8")).toBe(record);
    expect(fs.statSync(lockPath).mtimeMs).toBe(mtime);
  });
});
