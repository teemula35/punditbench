import { describe, expect, it } from "vitest";
import type { PreviousSeason } from "../lib/league-context";
import {
  buildSeasonPrompt,
  scoreSeasonTable,
  SEASON_PROMPT_VERSION,
  seasonCanonicalPayload,
  validateSeasonTable,
} from "../lib/season-prediction";
import type { SeasonPredictionFile } from "../lib/season-prediction";
import type { Competition } from "../lib/types";

const COMP: Competition = {
  id: "test-league",
  kind: "league",
  name: "Test League 2026-27",
  short_name: "Test League",
  season_label: "2026-27",
  espn_slug: "tst.1",
  team_count: 20,
  round_count: 38,
  active: false,
};

/** Actual final order: "Team 01" champion … "Team 20" last. */
const ACTUAL20 = Array.from({ length: 20 }, (_, i) => `Team ${String(i + 1).padStart(2, "0")}`);
const ACTUAL18 = ACTUAL20.slice(0, 18);

describe("scoreSeasonTable", () => {
  it("perfect 20-team table scores 59 (40 exact + 5 champion + 8 top-4 + 6 relegation)", () => {
    expect(scoreSeasonTable([...ACTUAL20], ACTUAL20)).toEqual({
      total: 59,
      exact: 20,
      offByOne: 0,
      champion: true,
      topFourHits: 4,
      relegationHits: 3,
    });
  });

  it("perfect 18-team table scores 53 (36 + 5 + 8 + 4) — only the bottom TWO relegate directly", () => {
    expect(scoreSeasonTable([...ACTUAL18], ACTUAL18)).toEqual({
      total: 53,
      exact: 18,
      offByOne: 0,
      champion: true,
      topFourHits: 4,
      relegationHits: 2,
    });
  });

  it("off-by-one earns 1 point and is exclusive with exact", () => {
    const predicted = [...ACTUAL20];
    [predicted[5], predicted[6]] = [predicted[6], predicted[5]]; // swap mid-table neighbours
    const s = scoreSeasonTable(predicted, ACTUAL20);
    expect(s.exact).toBe(18);
    expect(s.offByOne).toBe(2); // each swapped team counts once, as off-by-one only
    expect(s.champion).toBe(true);
    expect(s.topFourHits).toBe(4);
    expect(s.relegationHits).toBe(3);
    expect(s.total).toBe(57); // 36 + 2 + 5 + 8 + 6
  });

  it("two positions off earns no positional points", () => {
    const predicted = [...ACTUAL20];
    [predicted[5], predicted[7]] = [predicted[7], predicted[5]]; // both teams two off
    const s = scoreSeasonTable(predicted, ACTUAL20);
    expect(s.exact).toBe(18);
    expect(s.offByOne).toBe(0);
    expect(s.total).toBe(55); // 36 + 0 + 5 + 8 + 6
  });

  it("champion bonus applies even when the rest of the table is wrong", () => {
    // Champion right, every other team 9-10 places adrift: no other exact,
    // off-by-one, top-4 or relegation credit anywhere.
    const rest = ACTUAL20.slice(1);
    const predicted = [ACTUAL20[0], ...rest.slice(9), ...rest.slice(0, 9)];
    const s = scoreSeasonTable(predicted, ACTUAL20);
    expect(s.champion).toBe(true);
    expect(s.exact).toBe(1);
    expect(s.offByOne).toBe(0);
    expect(s.topFourHits).toBe(1); // the champion itself is the only top-4 hit
    expect(s.relegationHits).toBe(0);
    expect(s.total).toBe(9); // 2 + 5 + 2
  });

  it("top-4 and relegation hits are order-insensitive", () => {
    const predicted = [...ACTUAL20];
    predicted.splice(0, 4, ACTUAL20[3], ACTUAL20[2], ACTUAL20[1], ACTUAL20[0]); // reverse top 4
    predicted.splice(17, 3, ACTUAL20[19], ACTUAL20[18], ACTUAL20[17]); // reverse bottom 3
    const s = scoreSeasonTable(predicted, ACTUAL20);
    expect(s.champion).toBe(false); // wrong champion, yet all four top-4 teams hit
    expect(s.topFourHits).toBe(4);
    expect(s.relegationHits).toBe(3);
    expect(s.exact).toBe(14); // 13 untouched mid-table teams + the reversed bottom-3 pivot
    expect(s.offByOne).toBe(2); // inner pair of the reversed top 4
    expect(s.total).toBe(44); // 28 + 2 + 0 + 8 + 6
  });
});

describe("validateSeasonTable", () => {
  const TEAMS = ["Arsenal", "Burnley", "Chelsea", "Derby"];

  it("accepts a complete permutation and preserves the predicted order", () => {
    const v = validateSeasonTable('{"table":["Chelsea","Arsenal","Derby","Burnley"]}', TEAMS);
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
    expect(v.table).toEqual(["Chelsea", "Arsenal", "Derby", "Burnley"]);
  });

  it("accepts fenced JSON via extractJson", () => {
    const raw = 'Here you go:\n```json\n{"table":["Arsenal","Burnley","Chelsea","Derby"]}\n```';
    const v = validateSeasonTable(raw, TEAMS);
    expect(v.ok).toBe(true);
    expect(v.table).toEqual(TEAMS);
  });

  it("names missing, duplicate and unknown teams in the errors", () => {
    const v = validateSeasonTable('{"table":["Arsenal","Arsenal","Everton","Chelsea"]}', TEAMS);
    expect(v.ok).toBe(false);
    expect(v.table).toEqual([]);
    expect(v.errors.some((e) => e.startsWith("duplicate: Arsenal"))).toBe(true);
    expect(v.errors.some((e) => e.startsWith("unknown: Everton"))).toBe(true);
    expect(v.errors.some((e) => e.startsWith("missing: Burnley"))).toBe(true);
    expect(v.errors.some((e) => e.startsWith("missing: Derby"))).toBe(true);
  });

  it("matches spellings exactly — no fuzzy matching", () => {
    const v = validateSeasonTable('{"table":["arsenal","Burnley","Chelsea","Derby"]}', TEAMS);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.startsWith("unknown: arsenal"))).toBe(true);
    expect(v.errors.some((e) => e.startsWith("missing: Arsenal"))).toBe(true);
  });

  it("rejects unparseable input and a missing table key", () => {
    expect(validateSeasonTable("no json here", TEAMS)).toEqual({
      ok: false,
      errors: ["Response is not parseable JSON."],
      table: [],
    });
    expect(validateSeasonTable('{"predictions":[]}', TEAMS).errors).toEqual([
      'Top-level key "table" missing or not an array.',
    ]);
  });

  it("rejects non-string entries", () => {
    const v = validateSeasonTable('{"table":["Arsenal",2,"Chelsea","Derby"]}', TEAMS);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("is not a string"))).toBe(true);
    expect(v.errors.some((e) => e.startsWith("missing: Burnley"))).toBe(true);
  });
});

describe("buildSeasonPrompt", () => {
  const TEAMS_UNSORTED = ["Everton", "Arsenal", "Chelsea", "Burnley"];

  const PREV: PreviousSeason = {
    season: "2025-26",
    table: ["Liverpool", "Arsenal", "Manchester City"],
    promoted: ["Leeds United", "Burnley", "Sunderland"],
    note: "Sunderland won the playoff final.",
  };

  it("exports the season prompt version", () => {
    expect(SEASON_PROMPT_VERSION).toBe("season-v1");
  });

  it("is deterministic — identical arguments give an identical string", () => {
    expect(buildSeasonPrompt(COMP, TEAMS_UNSORTED, PREV)).toBe(buildSeasonPrompt(COMP, TEAMS_UNSORTED, PREV));
  });

  it("opens like the league prompt and states the whole-season task", () => {
    const p = buildSeasonPrompt(COMP, TEAMS_UNSORTED);
    expect(p.startsWith("PunditBench — a public benchmark")).toBe(true);
    expect(p).toContain(
      "Your task: predict the FINAL league table for the whole Test League 2026-27 season, best to worst.",
    );
  });

  it("keeps the strict output rules and the season scoring line, with no advancer anywhere", () => {
    const p = buildSeasonPrompt(COMP, TEAMS_UNSORTED, PREV);
    expect(p).toContain("- Respond with ONLY one JSON object. No markdown fences, no explanations, no other text.");
    expect(p).toContain('- Format: {"table":["Team 1","Team 2",...]}');
    expect(p).toContain(
      "- List every team from the team list below exactly once, spelled exactly as in the list provided. No omissions, no duplicates, no other teams.",
    );
    expect(p).toContain(
      "Scoring (identical for all participants): exact position = 2 points; one position off = 1; correct champion = +5; each correct top-4 team (any order) = +2; each correct relegated team (any order) = +2.",
    );
    expect(p.toLowerCase()).not.toContain("advanc");
  });

  it("lists the teams alphabetically under the team header, ending the prompt", () => {
    const p = buildSeasonPrompt(COMP, TEAMS_UNSORTED, PREV);
    const idx = p.indexOf("Teams (predict all of them):");
    expect(idx).toBeGreaterThan(-1);
    expect(p.slice(idx).split("\n").slice(1)).toEqual(["Arsenal", "Burnley", "Chelsea", "Everton"]);
  });

  it("includes the previous-season table and promotions but NEVER the note", () => {
    const p = buildSeasonPrompt(COMP, TEAMS_UNSORTED, PREV);
    expect(p).toContain("Previous season (2025-26) final table:");
    expect(p).toContain("1. Liverpool");
    expect(p).toContain("3. Manchester City");
    expect(p).toContain("Promoted this season: Leeds United, Burnley, Sunderland.");
    // The note field is file provenance for auditors, never model-facing.
    expect(p).not.toContain("Sunderland won the playoff final.");
    expect(p).not.toContain(PREV.note!);
  });

  it("omits the previous-season section when none is provided", () => {
    expect(buildSeasonPrompt(COMP, TEAMS_UNSORTED)).not.toContain("Previous season");
  });
});

describe("seasonCanonicalPayload", () => {
  function file(over: Partial<SeasonPredictionFile>): SeasonPredictionFile {
    return {
      model: "vendor/model",
      slug: "vendor-model",
      competition: "test-league",
      kind: "season-table",
      prompt_version: "season-v1",
      params: {},
      requested_at: "2026-08-20T06:00:00Z",
      completed_at: "2026-08-20T06:00:10Z",
      attempts: 1,
      table: ["Chelsea", "Arsenal", "Derby", "Burnley"],
      ...over,
    };
  }

  it("sorts by slug, keeps table order, and ignores volatile fields", () => {
    const a = file({ slug: "a-model" });
    const b = file({ slug: "b-model", attempts: 3, params: { temperature: 0 }, usage: { cost_usd: 1 } });
    const payload = seasonCanonicalPayload([b, a]);
    expect(payload.indexOf('"slug":"a-model"')).toBeLessThan(payload.indexOf('"slug":"b-model"'));
    expect(payload).toBe(seasonCanonicalPayload([a, file({ slug: "b-model" })]));
    expect(payload).toContain('"table":["Chelsea","Arsenal","Derby","Burnley"]');
    expect(payload).not.toContain(" "); // no whitespace (single-word fixture names)
  });
});
