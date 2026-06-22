import { describe, expect, it } from "vitest";
import {
  computePersonalities,
  siliconRatings,
  traitBand,
  FAVOURITE_MARGIN,
} from "../lib/personality";
import type { Fixture, PredictionFile, StageId } from "../lib/types";

function gf(match: number, home: string, away: string, group = "A"): Fixture {
  return { match, stage: "group", group, home, away, kickoff_utc: "2026-06-11T00:00:00Z", city: "X" };
}

/** A stored group file from [match, home_goals, away_goals] triples. */
function groupFile(slug: string, preds: [number, number, number][], stage: StageId = "group"): PredictionFile {
  return {
    model: slug,
    slug,
    stage,
    prompt_version: "v1",
    params: {},
    requested_at: "2026-06-10T00:00:00Z",
    completed_at: "2026-06-10T00:00:00Z",
    attempts: 1,
    predictions: preds.map(([match, home_goals, away_goals]) => ({ match, home_goals, away_goals })),
  };
}

function field(entries: Record<string, [number, number, number][]>): Map<string, PredictionFile[]> {
  return new Map(Object.entries(entries).map(([slug, preds]) => [slug, [groupFile(slug, preds)]]));
}

describe("computePersonalities — goals and draws", () => {
  const fixtures = [gf(1, "A", "B"), gf(2, "C", "D", "B")];
  const p = computePersonalities(
    field({
      attacker: [
        [1, 2, 1],
        [2, 3, 0],
      ],
      cagey: [
        [1, 1, 1],
        [2, 0, 0],
      ],
    }),
    fixtures,
  );

  it("goals per game is the mean of home+away over predicted group matches", () => {
    expect(p.get("attacker")!.goalsPerGame).toBeCloseTo(3.0);
    expect(p.get("cagey")!.goalsPerGame).toBeCloseTo(1.0);
  });

  it("draw rate is the share of level scorelines", () => {
    expect(p.get("attacker")!.drawRate).toBe(0);
    expect(p.get("cagey")!.drawRate).toBe(1);
  });

  it("ranks each trait with 1 = highest value", () => {
    expect(p.get("attacker")!.rank.goalsPerGame).toBe(1);
    expect(p.get("cagey")!.rank.goalsPerGame).toBe(2);
    expect(p.get("cagey")!.rank.drawRate).toBe(1);
    expect(p.get("attacker")!.rank.drawRate).toBe(2);
    expect(p.get("attacker")!.fieldSize).toBe(2);
  });
});

describe("computePersonalities — chalk index (agreement with the rest of the field)", () => {
  // One fixture: two models call a home win, one calls an away win.
  const p = computePersonalities(
    field({ home1: [[1, 2, 0]], home2: [[1, 1, 0]], away1: [[1, 0, 1]] }),
    [gf(1, "A", "B")],
  );

  it("a majority-outcome model agrees with the share of the others that match", () => {
    // 2 of 3 picked home → for a home picker, 1 of the other 2 agrees → 0.5.
    expect(p.get("home1")!.chalkIndex).toBeCloseTo(0.5);
  });

  it("a lone dissenter has zero agreement", () => {
    expect(p.get("away1")!.chalkIndex).toBe(0);
  });

  it("the contrarian ranks last on chalk, the conformists first", () => {
    expect(p.get("away1")!.rank.chalkIndex).toBe(3);
    expect(p.get("home1")!.rank.chalkIndex).toBe(1);
  });
});

describe("siliconRatings + favourite bias", () => {
  // The field collectively rates "Strong" far above "Weak".
  const predictions = field({
    chalk1: [[1, 3, 0]],
    chalk2: [[1, 2, 0]],
    upsetter: [[1, 0, 1]],
  });
  const fixtures = [gf(1, "Strong", "Weak")];

  it("derives a power rating as mean predicted goal difference per team", () => {
    const r = siliconRatings(predictions, fixtures);
    // Strong GD per model: +3, +2, -1 → mean 4/3; Weak is the mirror.
    expect(r.get("Strong")!).toBeCloseTo(4 / 3);
    expect(r.get("Weak")!).toBeCloseTo(-4 / 3);
    // The gap clears the clear-favourite threshold.
    expect(Math.abs(r.get("Strong")! - r.get("Weak")!)).toBeGreaterThanOrEqual(FAVOURITE_MARGIN);
  });

  it("counts an underdog win as an upset, a favourite win as not", () => {
    const p = computePersonalities(predictions, fixtures);
    expect(p.get("upsetter")!).toMatchObject({ favMatches: 1, upsetPicks: 1, upsetRate: 1 });
    expect(p.get("chalk1")!).toMatchObject({ favMatches: 1, upsetPicks: 0, upsetRate: 0 });
  });

  it("ignores coin-flip fixtures with no clear favourite", () => {
    // Field splits evenly → ratings ~0 → no favourite → no upset accounting.
    const even = field({ a: [[1, 1, 0]], b: [[1, 0, 1]] });
    const p = computePersonalities(even, [gf(1, "A", "B")]);
    expect(p.get("a")!.favMatches).toBe(0);
    expect(p.get("a")!.upsetRate).toBe(0);
  });
});

describe("computePersonalities — what counts as a prediction", () => {
  const fixtures = [gf(1, "A", "B")];

  it("skips models with no stored group file", () => {
    const ko = new Map([["konly", [groupFile("konly", [[74, 1, 0]], "r32")]]]);
    expect(computePersonalities(ko, fixtures).has("konly")).toBe(false);
  });

  it("ignores predictions for matches outside the group fixture set", () => {
    const p = computePersonalities(field({ m: [[1, 2, 0], [999, 5, 5]] }), fixtures);
    expect(p.get("m")!.predicted).toBe(1);
    expect(p.get("m")!.goalsPerGame).toBeCloseTo(2);
  });

  it("drops a model whose predictions are all off-slate", () => {
    expect(computePersonalities(field({ ghost: [[999, 1, 1]] }), fixtures).has("ghost")).toBe(false);
  });
});

describe("traitBand", () => {
  it("splits a field into thirds (1 = top third by value)", () => {
    expect(traitBand(1, 9)).toBe(1);
    expect(traitBand(3, 9)).toBe(1);
    expect(traitBand(4, 9)).toBe(0);
    expect(traitBand(6, 9)).toBe(0);
    expect(traitBand(7, 9)).toBe(-1);
    expect(traitBand(9, 9)).toBe(-1);
  });

  it("is neutral when the field is too small to band", () => {
    expect(traitBand(1, 2)).toBe(0);
  });
});
