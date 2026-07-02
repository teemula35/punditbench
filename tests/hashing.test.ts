import { describe, expect, it } from "vitest";
import { canonicalPayload, sha256 } from "../lib/hashing";
import type { PredictionFile } from "../lib/types";

function file(over: Partial<PredictionFile>): PredictionFile {
  return {
    model: "vendor/model",
    slug: "vendor-model",
    stage: "md01",
    prompt_version: "league-v1",
    params: {},
    requested_at: "2026-08-20T06:00:00Z",
    completed_at: "2026-08-20T06:00:10Z",
    attempts: 1,
    predictions: [
      { match: 2, home_goals: 1, away_goals: 1 },
      { match: 1, home_goals: 2, away_goals: 0 },
    ],
    ...over,
  };
}

describe("canonicalPayload", () => {
  it("is independent of file order and prediction order", () => {
    const a = file({ slug: "a-model" });
    const b = file({ slug: "b-model" });
    const bShuffled = { ...b, predictions: [...b.predictions].reverse() };
    expect(canonicalPayload([a, b])).toBe(canonicalPayload([bShuffled, a]));
  });

  it("includes stage and simulated_fixtures when present", () => {
    const sim = file({
      stage: "r32",
      simulated_fixtures: [
        { match: 74, home: "X", away: "Y" },
        { match: 73, home: "A", away: "B" },
      ],
    });
    const payload = canonicalPayload([sim]);
    expect(payload).toContain('"stage":"r32"');
    expect(payload.indexOf('"match":73')).toBeLessThan(payload.indexOf('"match":74'));
  });

  it("ignores volatile fields (params, usage, attempts)", () => {
    const a = file({});
    const b = file({ attempts: 3, params: { temperature: 0 }, usage: { cost_usd: 1 } });
    expect(canonicalPayload([a])).toBe(canonicalPayload([b]));
  });

  it("sha256 is stable for a given payload", () => {
    const p = canonicalPayload([file({})]);
    expect(sha256(p)).toBe(sha256(p));
    expect(sha256(p)).toMatch(/^[0-9a-f]{64}$/);
  });
});
