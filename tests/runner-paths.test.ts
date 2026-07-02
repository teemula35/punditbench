import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runModelOnFixtures } from "../lib/runner";
import type { Fixture, RosterModel } from "../lib/types";

const MODEL: RosterModel = { id: "test/model-x", label: "Model X", vendor: "Test", tier: "small" };
const FIXTURES: Fixture[] = [
  {
    match: 1,
    stage: "md01",
    round: 1,
    home: "A",
    away: "B",
    kickoff_utc: "2026-08-21T19:00:00Z",
    city: "",
    espn_id: "1",
  },
];

/**
 * Regression: with opts.dataRoot set, BOTH the prediction file and the raw
 * attempt log must land inside the competition tree — never in the default
 * data/predictions-live / data/raw-live WC trees. (A mock run once leaked its
 * raw logs into data/raw-live because one appendRaw call site missed the
 * dataRoot argument.)
 */
describe("runner dataRoot routing", () => {
  let tmp: string;
  let prevCwd: string;

  beforeEach(() => {
    prevCwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "punditbench-runner-"));
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(prevCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("routes predictions AND raw logs into the dataRoot tree", async () => {
    const dataRoot = path.join("data", "competitions", "test-league");
    const outcome = await runModelOnFixtures(MODEL, "test-model-x", "md01", FIXTURES, "prompt", {
      mock: true,
      promptVersion: "league-v1",
      variant: "live",
      dataRoot,
    });
    expect(outcome.ok).toBe(true);
    expect(
      fs.existsSync(path.join(tmp, dataRoot, "predictions-live", "md01", "test-model-x.json")),
    ).toBe(true);
    expect(fs.existsSync(path.join(tmp, dataRoot, "raw-live", "md01", "test-model-x.jsonl"))).toBe(
      true,
    );
    // Nothing may leak into the default WC trees.
    expect(fs.existsSync(path.join(tmp, "data", "predictions-live"))).toBe(false);
    expect(fs.existsSync(path.join(tmp, "data", "raw-live"))).toBe(false);
  });

  it("defaults to the WC trees when dataRoot is not set", async () => {
    const outcome = await runModelOnFixtures(MODEL, "test-model-x", "r32", FIXTURES, "prompt", {
      mock: true,
      promptVersion: "v1",
      variant: "live",
    });
    expect(outcome.ok).toBe(true);
    expect(fs.existsSync(path.join(tmp, "data", "predictions-live", "r32", "test-model-x.json"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(tmp, "data", "raw-live", "r32", "test-model-x.jsonl"))).toBe(true);
  });
});
