/**
 * Per-model tournament simulation: from a model's 72 group-stage score
 * predictions, derive ITS OWN group tables, qualifiers, third-place slotting
 * and knockout pairings, round by round. Match numbers 73-104 are structural
 * bracket slots shared with the real tournament; the teams filling them come
 * from the model's predicted universe.
 */
import { groupTable, thirdPlaceRanking, type TableRow } from "./standings";
import type { Fixture, KnockoutSlot, MatchResult, PredictionFile, StageId, Team } from "./types";

export function predictionsAsResults(file: PredictionFile): Map<number, MatchResult> {
  return new Map(
    file.predictions.map((p) => [
      p.match,
      { match: p.match, status: "final" as const, home_goals: p.home_goals, away_goals: p.away_goals },
    ]),
  );
}

export interface SimulatedGroups {
  tables: Map<string, TableRow[]>;
  /** All 12 third-placed teams, ranked; the top 8 qualify. */
  thirdsRanked: TableRow[];
  groupOf: Map<string, string>;
}

export function simulateGroups(
  file: PredictionFile,
  teams: Team[],
  groupFixtures: Fixture[],
): SimulatedGroups {
  const results = predictionsAsResults(file);
  const groups = [...new Set(teams.map((t) => t.group))].sort();
  const tables = new Map(groups.map((g) => [g, groupTable(g, teams, groupFixtures, results)]));
  const thirdsRanked = thirdPlaceRanking(tables);
  const groupOf = new Map(teams.map((t) => [t.name, t.group]));
  return { tables, thirdsRanked, groupOf };
}

/** Parse a third-place slot label like "3C/D/F/G/H" into its eligible groups. */
export function parseThirdSlot(slot: string): string[] | undefined {
  const m = slot.match(/^3([A-L](?:\/[A-L])*)$/);
  return m ? m[1].split("/") : undefined;
}

/**
 * Official third-place allocation (FIFA Regulations Annexe C, see
 * ALLOCATION-NOTES.md): the SET of the 8 qualifying groups uniquely selects a
 * published row that dictates which group's third plays in which R32 match.
 * Rank order among the 8 is irrelevant. data/third-allocation.json covers all
 * 495 combinations (machine-validated against the regulations PDF).
 */
export function allocateThirds(
  qualified: { team: string; group: string }[],
  table: Record<string, Record<string, string>>,
): Map<number, string> {
  const key = qualified.map((q) => q.group).sort().join("");
  const row = table[key];
  if (!row) throw new Error(`no Annexe C row for qualified-groups combination ${key}`);
  const teamOfGroup = new Map(qualified.map((q) => [q.group, q.team]));
  const out = new Map<number, string>();
  for (const [match, group] of Object.entries(row)) {
    const team = teamOfGroup.get(group);
    if (!team) throw new Error(`Annexe C row ${key} assigns group ${group} which did not qualify`);
    out.set(Number(match), team);
  }
  return out;
}

function fixtureFromSlot(slot: KnockoutSlot, home: string, away: string): Fixture {
  return {
    match: slot.match,
    stage: slot.stage,
    home,
    away,
    kickoff_utc: slot.kickoff_utc,
    city: slot.city,
    stadium: slot.stadium,
  };
}

/** Build a model's simulated Round-of-32 from its group outcome. */
export function buildSimulatedR32(
  sim: SimulatedGroups,
  template: KnockoutSlot[],
  allocationTable: Record<string, Record<string, string>>,
): Fixture[] {
  const r32 = template.filter((s) => s.stage === "r32");

  const qualifiedThirds = sim.thirdsRanked.slice(0, 8).map((row) => ({
    team: row.team,
    group: sim.groupOf.get(row.team)!,
  }));
  const thirdAssignment = allocateThirds(qualifiedThirds, allocationTable);

  const resolve = (slot: string, match: number): string => {
    const groupPos = slot.match(/^([12])([A-L])$/);
    if (groupPos) {
      const row = sim.tables.get(groupPos[2])?.[Number(groupPos[1]) - 1];
      if (!row) throw new Error(`cannot resolve slot ${slot}`);
      return row.team;
    }
    if (parseThirdSlot(slot)) {
      const team = thirdAssignment.get(match);
      if (!team) throw new Error(`no third assigned to slot ${slot} (match ${match})`);
      return team;
    }
    throw new Error(`unsupported R32 slot ${slot}`);
  };

  return r32
    .map((s) => fixtureFromSlot(s, resolve(s.home_slot, s.match), resolve(s.away_slot, s.match)))
    .sort((a, b) => a.match - b.match);
}

/**
 * Build the next simulated round from the model's previous-round pairings and
 * its `advances` answers. Supports winner (W##) and loser (L##) slots.
 */
export function buildNextSimulatedRound(
  template: KnockoutSlot[],
  stage: StageId,
  previous: Map<number, { home: string; away: string; advances: string }>,
): Fixture[] {
  const resolve = (slot: string): string => {
    const w = slot.match(/^W(\d+)$/);
    if (w) {
      const m = previous.get(Number(w[1]));
      if (!m) throw new Error(`winner of match ${w[1]} not simulated yet`);
      return m.advances;
    }
    const l = slot.match(/^L(\d+)$/);
    if (l) {
      const m = previous.get(Number(l[1]));
      if (!m) throw new Error(`loser of match ${l[1]} not simulated yet`);
      return m.advances === m.home ? m.away : m.home;
    }
    throw new Error(`unsupported slot ${slot} for stage ${stage}`);
  };

  return template
    .filter((s) => s.stage === stage)
    .map((s) => fixtureFromSlot(s, resolve(s.home_slot), resolve(s.away_slot)))
    .sort((a, b) => a.match - b.match);
}

/** advances per simulated match, derived from a stored knockout prediction file. */
export function advancesByMatch(
  file: PredictionFile,
): Map<number, { home: string; away: string; advances: string }> {
  const out = new Map<number, { home: string; away: string; advances: string }>();
  const fixtures = new Map((file.simulated_fixtures ?? []).map((f) => [f.match, f]));
  for (const p of file.predictions) {
    const f = fixtures.get(p.match);
    if (!f) continue;
    const advances =
      p.advances ?? (p.home_goals > p.away_goals ? f.home : p.away_goals > p.home_goals ? f.away : undefined);
    if (!advances) continue;
    out.set(p.match, { home: f.home, away: f.away, advances });
  }
  return out;
}
