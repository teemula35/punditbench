import { describe, expect, it } from "vitest";
import {
  allocateThirds,
  advancesByMatch,
  buildNextSimulatedRound,
  parseThirdSlot,
} from "../lib/bracket";
import { loadKnockoutTemplate, loadThirdAllocationTable } from "../lib/data";
import type { KnockoutSlot, PredictionFile } from "../lib/types";

describe("parseThirdSlot", () => {
  it("parses eligibility sets and rejects non-third slots", () => {
    expect(parseThirdSlot("3C/D/F/G/H")).toEqual(["C", "D", "F", "G", "H"]);
    expect(parseThirdSlot("1A")).toBeUndefined();
    expect(parseThirdSlot("W74")).toBeUndefined();
  });
});

describe("allocateThirds — official Annexe C lookup", () => {
  const table = loadThirdAllocationTable();
  const template = loadKnockoutTemplate();

  it("covers all 495 possible 8-group combinations exactly once", () => {
    const keys = Object.keys(table);
    expect(keys).toHaveLength(495);
    for (const key of keys) {
      expect(key).toMatch(/^[A-L]{8}$/);
      expect([...key].sort().join("")).toBe(key);
      // The row assigns exactly the qualified groups.
      expect(Object.values(table[key]).sort().join("")).toBe(key);
    }
  });

  it("every assignment respects the bracket template's eligibility labels", () => {
    const eligibility = new Map<number, string[]>();
    for (const s of template.filter((t) => t.stage === "r32")) {
      for (const slot of [s.home_slot, s.away_slot]) {
        const e = parseThirdSlot(slot);
        if (e) eligibility.set(s.match, e);
      }
    }
    expect([...eligibility.keys()].sort((a, b) => a - b)).toEqual([74, 77, 79, 80, 81, 82, 85, 87]);
    for (const row of Object.values(table)) {
      for (const [match, group] of Object.entries(row)) {
        expect(eligibility.get(Number(match)), `match ${match} group ${group}`).toContain(group);
      }
    }
  });

  it("resolves a known regulation row (option 1: EFGHIJKL)", () => {
    const qualified = [..."EFGHIJKL"].map((g) => ({ team: `Third${g}`, group: g }));
    const result = allocateThirds(qualified, table);
    expect(result.get(79)).toBe("ThirdE");
    expect(result.get(85)).toBe("ThirdJ");
    expect(result.get(81)).toBe("ThirdI");
    expect(result.get(74)).toBe("ThirdF");
    expect(result.get(82)).toBe("ThirdH");
    expect(result.get(77)).toBe("ThirdG");
    expect(result.get(87)).toBe("ThirdL");
    expect(result.get(80)).toBe("ThirdK");
  });

  it("throws on an unknown combination key", () => {
    expect(() =>
      allocateThirds([{ team: "X", group: "A" }], table),
    ).toThrow(/no Annexe C row/);
  });
});

describe("buildNextSimulatedRound", () => {
  const template: KnockoutSlot[] = [
    { match: 101, stage: "sf", home_slot: "W97", away_slot: "W98", kickoff_utc: "2026-07-14T20:00:00Z", city: "Arlington" },
    { match: 103, stage: "third", home_slot: "L101", away_slot: "L102", kickoff_utc: "2026-07-18T20:00:00Z", city: "Miami Gardens" },
    { match: 104, stage: "final", home_slot: "W101", away_slot: "W102", kickoff_utc: "2026-07-19T19:00:00Z", city: "East Rutherford" },
  ];

  it("resolves winner slots", () => {
    const prev = new Map([
      [97, { home: "Spain", away: "France", advances: "Spain" }],
      [98, { home: "Brazil", away: "England", advances: "England" }],
    ]);
    const [sf] = buildNextSimulatedRound(template, "sf", prev);
    expect(sf).toMatchObject({ match: 101, home: "Spain", away: "England" });
  });

  it("resolves loser slots for the third-place match", () => {
    const prev = new Map([
      [101, { home: "Spain", away: "England", advances: "Spain" }],
      [102, { home: "Argentina", away: "Germany", advances: "Argentina" }],
    ]);
    const [third] = buildNextSimulatedRound(template, "third", prev);
    expect(third).toMatchObject({ match: 103, home: "England", away: "Germany" });
    const [final] = buildNextSimulatedRound(template, "final", prev);
    expect(final).toMatchObject({ match: 104, home: "Spain", away: "Argentina" });
  });

  it("throws when a required earlier match is missing", () => {
    expect(() => buildNextSimulatedRound(template, "sf", new Map())).toThrow(/not simulated yet/);
  });
});

describe("advancesByMatch", () => {
  it("derives advancing teams from explicit field or decisive score", () => {
    const file: PredictionFile = {
      model: "m", slug: "m", stage: "r32", prompt_version: "sim-v1", params: {},
      requested_at: "", completed_at: "", attempts: 1,
      simulated_fixtures: [
        { match: 73, home: "Spain", away: "Poland" },
        { match: 74, home: "Brazil", away: "Ghana" },
      ],
      predictions: [
        { match: 73, home_goals: 1, away_goals: 1, advances: "Poland" },
        { match: 74, home_goals: 2, away_goals: 0 },
      ],
    };
    const adv = advancesByMatch(file);
    expect(adv.get(73)?.advances).toBe("Poland");
    expect(adv.get(74)?.advances).toBe("Brazil");
  });
});
