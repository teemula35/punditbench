import type { Fixture, MatchResult, Team } from "./types";

export interface TableRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

/**
 * Group tables from final results. FIFA tiebreakers implemented: points → GD →
 * goals scored → head-to-head (points, GD, goals) among tied teams. Beyond that
 * (fair play / drawing of lots) we cannot compute from scores — break those ties
 * via data/overrides/group-order.json: {"A": ["Team1","Team2","Team3","Team4"], ...}
 * listing the OFFICIAL final order; the override wins entirely for that group.
 */
export function groupTable(
  group: string,
  teams: Team[],
  fixtures: Fixture[],
  results: Map<number, MatchResult>,
  override?: string[],
): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const t of teams.filter((t) => t.group === group)) {
    rows.set(t.name, { team: t.name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
  }
  const groupFixtures = fixtures.filter((f) => f.group === group);
  for (const f of groupFixtures) {
    const r = results.get(f.match);
    if (!r || r.status !== "final" || r.home_goals === undefined || r.away_goals === undefined) continue;
    const home = rows.get(f.home);
    const away = rows.get(f.away);
    if (!home || !away) continue;
    home.played++; away.played++;
    home.gf += r.home_goals; home.ga += r.away_goals;
    away.gf += r.away_goals; away.ga += r.home_goals;
    if (r.home_goals > r.away_goals) { home.won++; away.lost++; home.points += 3; }
    else if (r.home_goals < r.away_goals) { away.won++; home.lost++; away.points += 3; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  }
  for (const row of rows.values()) row.gd = row.gf - row.ga;

  if (override && override.length === rows.size) {
    return override.map((name) => {
      const row = rows.get(name);
      if (!row) throw new Error(`group-order override for ${group} names unknown team "${name}"`);
      return row;
    });
  }

  const list = [...rows.values()];
  // Head-to-head mini-table among an exactly-tied subset.
  const h2h = (subset: TableRow[]): Map<string, { p: number; gd: number; gf: number }> => {
    const names = new Set(subset.map((s) => s.team));
    const mini = new Map<string, { p: number; gd: number; gf: number }>();
    for (const n of names) mini.set(n, { p: 0, gd: 0, gf: 0 });
    for (const f of groupFixtures) {
      if (!names.has(f.home) || !names.has(f.away)) continue;
      const r = results.get(f.match);
      if (!r || r.status !== "final" || r.home_goals === undefined || r.away_goals === undefined) continue;
      const h = mini.get(f.home)!, a = mini.get(f.away)!;
      h.gd += r.home_goals - r.away_goals; a.gd += r.away_goals - r.home_goals;
      h.gf += r.home_goals; a.gf += r.away_goals;
      if (r.home_goals > r.away_goals) h.p += 3;
      else if (r.home_goals < r.away_goals) a.p += 3;
      else { h.p++; a.p++; }
    }
    return mini;
  };

  list.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  // Apply head-to-head inside groups of teams still fully tied on the three criteria.
  for (let i = 0; i < list.length; ) {
    let j = i + 1;
    while (
      j < list.length &&
      list[j].points === list[i].points &&
      list[j].gd === list[i].gd &&
      list[j].gf === list[i].gf
    ) j++;
    if (j - i > 1) {
      const mini = h2h(list.slice(i, j));
      const segment = list.slice(i, j).sort((a, b) => {
        const ma = mini.get(a.team)!, mb = mini.get(b.team)!;
        return mb.p - ma.p || mb.gd - ma.gd || mb.gf - ma.gf || a.team.localeCompare(b.team);
      });
      list.splice(i, j - i, ...segment);
    }
    i = j;
  }
  return list;
}

/**
 * Ranking of third-placed teams (8 of 12 advance): points → GD → goals scored,
 * then alphabetical as a deterministic placeholder — if reality ever reaches that
 * deep tie, set data/overrides/third-order.json: ["TeamX", ...] (full official order).
 */
export function thirdPlaceRanking(tables: Map<string, TableRow[]>, override?: string[]): TableRow[] {
  const thirds = [...tables.values()].map((t) => t[2]).filter(Boolean);
  if (override && override.length === thirds.length) {
    return override.map((name) => {
      const row = thirds.find((r) => r.team === name);
      if (!row) throw new Error(`third-order override names unknown team "${name}"`);
      return row;
    });
  }
  return thirds.sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team),
  );
}
