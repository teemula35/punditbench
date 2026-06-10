/**
 * A2 structural invariants for the canonical tournament data. These run in CI
 * forever — if a fixture edit ever breaks an invariant, the build fails.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Fixture, KnockoutSlot, Team } from "../lib/types";

const read = <T>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", rel), "utf-8")) as T;

const teams = read<Team[]>("teams.json");
const group = read<Fixture[]>("fixtures/group.json");
const knockout = read<KnockoutSlot[]>("fixtures/knockout-template.json");

describe("teams.json", () => {
  it("has 48 teams in 12 groups of 4 with unique names and codes", () => {
    expect(teams).toHaveLength(48);
    expect(new Set(teams.map((t) => t.name)).size).toBe(48);
    expect(new Set(teams.map((t) => t.code)).size).toBe(48);
    const groups = [..."ABCDEFGHIJKL"];
    for (const g of groups) {
      expect(teams.filter((t) => t.group === g)).toHaveLength(4);
    }
  });
});

describe("fixtures/group.json", () => {
  it("has 72 matches numbered 1..72 exactly once", () => {
    expect(group).toHaveLength(72);
    expect(new Set(group.map((f) => f.match)).size).toBe(72);
    expect(Math.min(...group.map((f) => f.match))).toBe(1);
    expect(Math.max(...group.map((f) => f.match))).toBe(72);
  });

  it("every group is a complete round-robin (6 matches, each team plays 3)", () => {
    for (const g of [..."ABCDEFGHIJKL"]) {
      const fixtures = group.filter((f) => f.group === g);
      expect(fixtures).toHaveLength(6);
      const names = teams.filter((t) => t.group === g).map((t) => t.name);
      const counts = new Map(names.map((n) => [n, 0]));
      const pairs = new Set<string>();
      for (const f of fixtures) {
        expect(names).toContain(f.home);
        expect(names).toContain(f.away);
        counts.set(f.home, counts.get(f.home)! + 1);
        counts.set(f.away, counts.get(f.away)! + 1);
        pairs.add([f.home, f.away].sort().join("|"));
      }
      expect([...counts.values()]).toEqual([3, 3, 3, 3]);
      expect(pairs.size).toBe(6);
    }
  });

  it("kickoffs are valid UTC timestamps inside the group-stage window", () => {
    for (const f of group) {
      const t = Date.parse(f.kickoff_utc);
      expect(t, `match ${f.match} kickoff_utc`).not.toBeNaN();
      expect(t).toBeGreaterThanOrEqual(Date.parse("2026-06-11T00:00:00Z"));
      expect(t).toBeLessThanOrEqual(Date.parse("2026-06-28T12:00:00Z"));
    }
  });

  it("matches the known anchors (opener)", () => {
    const opener = group.find((f) => f.match === 1)!;
    expect(opener.home).toBe("Mexico");
    expect(opener.away).toBe("South Africa");
    expect(opener.city).toMatch(/Mexico City/);
    // 13:00 Mexico City (UTC-6) = 19:00Z — confirmed by two independent source sets.
    expect(opener.kickoff_utc).toBe("2026-06-11T19:00:00Z");
  });
});

describe("fixtures/knockout-template.json", () => {
  it("has matches 73..104 with the right stage counts", () => {
    expect(knockout).toHaveLength(32);
    expect(new Set(knockout.map((k) => k.match)).size).toBe(32);
    const byStage = (s: string) => knockout.filter((k) => k.stage === s).length;
    expect(byStage("r32")).toBe(16);
    expect(byStage("r16")).toBe(8);
    expect(byStage("qf")).toBe(4);
    expect(byStage("sf")).toBe(2);
    expect(byStage("third")).toBe(1);
    expect(byStage("final")).toBe(1);
  });

  it("R32 consumes each group winner and runner-up exactly once", () => {
    const slots = knockout.filter((k) => k.stage === "r32").flatMap((k) => [k.home_slot, k.away_slot]);
    for (const g of [..."ABCDEFGHIJKL"]) {
      expect(slots.filter((s) => s === `1${g}`), `1${g}`).toHaveLength(1);
      expect(slots.filter((s) => s === `2${g}`), `2${g}`).toHaveLength(1);
    }
    expect(slots.filter((s) => s.startsWith("3"))).toHaveLength(8);
  });

  it("later rounds consume earlier winners exactly once", () => {
    const expectWinners = (stage: string, from: number, to: number) => {
      const slots = knockout.filter((k) => k.stage === stage).flatMap((k) => [k.home_slot, k.away_slot]);
      const expected = Array.from({ length: to - from + 1 }, (_, i) => `W${from + i}`);
      expect([...slots].sort()).toEqual(expected.sort());
    };
    expectWinners("r16", 73, 88);
    expectWinners("qf", 89, 96);
    expectWinners("sf", 97, 100);
    const final = knockout.find((k) => k.stage === "final")!;
    expect([final.home_slot, final.away_slot].sort()).toEqual(["W101", "W102"]);
    expect(final.kickoff_utc.slice(0, 10)).toBe("2026-07-19");
  });
});
