import { describe, expect, it } from "vitest";
import type { PreviousSeason } from "../lib/league-context";
import { buildLeaguePrompt, LEAGUE_PROMPT_VERSION } from "../lib/league-prompt";
import type { TableRow } from "../lib/standings";
import type { Competition, Fixture } from "../lib/types";

const COMP: Competition = {
  id: "test-league",
  kind: "league",
  name: "Test League 2026-27",
  short_name: "Test League",
  season_label: "2026-27",
  espn_slug: "tst.1",
  team_count: 4,
  round_count: 6,
  active: false,
};

function fx(match: number, home: string, away: string, city: string, over: Partial<Fixture> = {}): Fixture {
  return {
    match,
    stage: "md05",
    round: 5,
    home,
    away,
    kickoff_utc: "2026-09-19T14:00:00Z",
    city,
    ...over,
  };
}

function row(team: string, over: Partial<TableRow> = {}): TableRow {
  return { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, ...over };
}

const FIXTURES = [fx(41, "Arsenal", "Chelsea", "London"), fx(42, "Derby", "Everton", "")];

const TABLE: TableRow[] = [
  row("Arsenal", { played: 4, won: 3, drawn: 1, lost: 0, gf: 8, ga: 2, gd: 6, points: 10 }),
  row("Chelsea", { played: 4, won: 2, drawn: 1, lost: 1, gf: 6, ga: 6, gd: 0, points: 7 }),
  row("Derby", { played: 4, won: 1, drawn: 0, lost: 3, gf: 3, ga: 7, gd: -4, points: 3 }),
  row("Everton", { played: 4, won: 0, drawn: 2, lost: 2, gf: 2, ga: 4, gd: -2, points: 2 }),
];

const FORM = new Map<string, string[]>([
  ["Arsenal", ["W 3-1 vs Coventry City (H)", "D 1-1 vs Chelsea (A)"]],
  ["Chelsea", ["D 1-1 vs Arsenal (H)"]],
  ["Derby", ["L 0-2 vs Everton (A)"]],
  ["Everton", []],
]);

const PREV: PreviousSeason = {
  season: "2025-26",
  table: ["Liverpool", "Arsenal", "Manchester City"],
  promoted: ["Leeds United", "Burnley", "Sunderland"],
  note: "Sunderland won the playoff final.",
};

const MD1_FIXTURES = [
  fx(1, "Arsenal", "Coventry City", "London", {
    stage: "md01",
    round: 1,
    kickoff_utc: "2026-08-21T19:00:00Z",
  }),
];

const ZERO_TABLE = TABLE.map((r) => row(r.team));

function inSeason(): string {
  return buildLeaguePrompt(COMP, "md05", FIXTURES, { table: TABLE, form: FORM });
}

describe("buildLeaguePrompt", () => {
  it("exports the league prompt version", () => {
    expect(LEAGUE_PROMPT_VERSION).toBe("league-v1");
  });

  it("is deterministic — identical arguments give an identical string", () => {
    expect(inSeason()).toBe(inSeason());
  });

  it("names the competition and the matchday from the round key", () => {
    const p = inSeason();
    expect(p).toContain(
      "PunditBench — a public benchmark in which language models predict football match results for the Test League 2026-27 season.",
    );
    expect(p).toContain(
      "Your task: predict the result of every Matchday 5 match listed at the end of this prompt.",
    );
    expect(buildLeaguePrompt(COMP, "md01", MD1_FIXTURES, { table: ZERO_TABLE, form: new Map() })).toContain(
      "every Matchday 1 match",
    );
  });

  it("keeps the strict output rules and league scoring, with no advancer anywhere", () => {
    const p = inSeason();
    expect(p).toContain("- Respond with ONLY one JSON object. No markdown fences, no explanations, no other text.");
    expect(p).toContain('- Format: {"predictions":[{"match":1,"home_goals":2,"away_goals":0},...]}');
    expect(p).toContain(
      "- home_goals/away_goals: integers 0-15, the final score after 90 minutes plus stoppage time (draws are possible in league play).",
    );
    expect(p).toContain("- Exactly one entry per listed match number — all of them.");
    expect(p).toContain(
      "Scoring (identical for all participants): exact score = 3 points; correct goal difference = 2; correct outcome (win/draw/loss) = 1.",
    );
    expect(p.toLowerCase()).not.toContain("advanc");
  });

  it("renders the in-season table with signed goal difference", () => {
    const p = inSeason();
    expect(p).toContain("Current league table (Pos. Team — P W D L GF-GA GD Pts):");
    expect(p).toContain("1. Arsenal — P4 W3 D1 L0 8-2 +6 10");
    expect(p).toContain("2. Chelsea — P4 W2 D1 L1 6-6 +0 7");
    expect(p).toContain("3. Derby — P4 W1 D0 L3 3-7 -4 3");
    expect(p).toContain("4. Everton — P4 W0 D2 L2 2-4 -2 2");
  });

  it("orders form by table position and omits teams without entries", () => {
    const p = inSeason();
    expect(p).toContain("Recent form (most recent first):");
    expect(p).toContain("Arsenal: W 3-1 vs Coventry City (H) | D 1-1 vs Chelsea (A)");
    expect(p.indexOf("Arsenal: W")).toBeLessThan(p.indexOf("Chelsea: D"));
    expect(p.indexOf("Chelsea: D")).toBeLessThan(p.indexOf("Derby: L"));
    expect(p).not.toContain("Everton:"); // empty form array — no line
  });

  it("orders form alphabetically when no table is shown", () => {
    const form = new Map<string, string[]>([
      ["Zebra Town", ["W 1-0 vs Aardvark City (H)"]],
      ["Aardvark City", ["L 0-1 vs Zebra Town (A)"]],
    ]);
    const p = buildLeaguePrompt(COMP, "md01", MD1_FIXTURES, { table: [], form });
    expect(p.indexOf("Aardvark City:")).toBeGreaterThan(-1);
    expect(p.indexOf("Aardvark City:")).toBeLessThan(p.indexOf("Zebra Town:"));
  });

  it("lists each fixture exactly once and ends at the fixture list", () => {
    const p = inSeason();
    expect(p).toContain("Matches to predict (match number | home vs away | date | city):");
    const fixtureLines = p.split("\n").filter((l) => /^\d+ \| /.test(l));
    expect(fixtureLines).toEqual([
      "41 | Arsenal vs Chelsea | 2026-09-19 | London",
      "42 | Derby vs Everton | 2026-09-19", // empty city — no trailing segment
    ]);
    expect(p.endsWith("42 | Derby vs Everton | 2026-09-19")).toBe(true);
  });

  it("omits the table before the season starts and shows the previous season instead", () => {
    const p = buildLeaguePrompt(COMP, "md01", MD1_FIXTURES, {
      table: ZERO_TABLE,
      form: new Map(),
      previousSeason: PREV,
    });
    expect(p).not.toContain("Current league table");
    expect(p).not.toContain("Recent form");
    expect(p).toContain("Previous season (2025-26) final table:");
    expect(p).toContain("1. Liverpool");
    expect(p).toContain("3. Manchester City");
    expect(p).toContain("Promoted this season: Leeds United, Burnley, Sunderland.");
    // The note field is file provenance for auditors, never model-facing.
    expect(p).not.toContain("Sunderland won the playoff final.");
  });

  it("omits the previous-season section when none is provided", () => {
    const p = buildLeaguePrompt(COMP, "md01", MD1_FIXTURES, { table: ZERO_TABLE, form: new Map() });
    expect(p).not.toContain("Current league table");
    expect(p).not.toContain("Previous season");
  });

  it("ignores previousSeason once the season has started", () => {
    const p = buildLeaguePrompt(COMP, "md05", FIXTURES, {
      table: TABLE,
      form: FORM,
      previousSeason: PREV,
    });
    expect(p).toContain("Current league table");
    expect(p).not.toContain("Previous season");
  });
});
