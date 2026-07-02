import { describe, expect, it } from "vitest";
import { loadCompetitions } from "../lib/data";
import { isMatchdayKey, matchdayNumber, mdKey, roundLabel } from "../lib/types";

describe("matchday keys", () => {
  it("mdKey zero-pads to two digits", () => {
    expect(mdKey(1)).toBe("md01");
    expect(mdKey(9)).toBe("md09");
    expect(mdKey(38)).toBe("md38");
  });

  it("matchdayNumber parses matchday keys and rejects WC stages", () => {
    expect(matchdayNumber("md07")).toBe(7);
    expect(matchdayNumber("md38")).toBe(38);
    expect(matchdayNumber("r32")).toBeUndefined();
    expect(matchdayNumber("group")).toBeUndefined();
    expect(matchdayNumber("final")).toBeUndefined();
  });

  it("isMatchdayKey accepts md keys only", () => {
    expect(isMatchdayKey("md01")).toBe(true);
    expect(isMatchdayKey("md5")).toBe(true);
    expect(isMatchdayKey("group")).toBe(false);
    expect(isMatchdayKey("final")).toBe(false);
    expect(isMatchdayKey("mdx")).toBe(false);
    expect(isMatchdayKey("")).toBe(false);
  });

  it("roundLabel covers both WC stages and matchdays", () => {
    expect(roundLabel("md07")).toBe("Matchday 7");
    expect(roundLabel("md21")).toBe("Matchday 21");
    expect(roundLabel("group")).toBe("Group stage");
    expect(roundLabel("r32")).toBe("Round of 32");
    expect(roundLabel("final")).toBe("Final");
  });

  it("md keys sort lexicographically in matchday order", () => {
    const keys = Array.from({ length: 38 }, (_, i) => mdKey(i + 1));
    expect([...keys].sort()).toEqual(keys);
  });
});

describe("competitions registry (data/competitions.json)", () => {
  const comps = loadCompetitions();

  it("loads the five launch leagues", () => {
    expect(comps.length).toBeGreaterThanOrEqual(5);
  });

  it("ids are unique kebab-case", () => {
    const ids = comps.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("espn slugs look like ESPN soccer league codes", () => {
    for (const c of comps) expect(c.espn_slug).toMatch(/^[a-z]+\.\d+$/);
  });

  it("espn slugs are unique (one competition per feed per season set)", () => {
    const slugs = comps.map((c) => c.espn_slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("round count is a double round-robin of team_count", () => {
    for (const c of comps) {
      expect(c.kind).toBe("league");
      expect(c.round_count).toBe((c.team_count - 1) * 2);
    }
  });

  it("active is an explicit boolean on every entry", () => {
    for (const c of comps) expect(typeof c.active).toBe("boolean");
  });
});
