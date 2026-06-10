/**
 * G1/A7 helper: resolve a knockout round's fixtures from the official bracket
 * template + real results, for the tight prompt-run windows.
 *
 *   npm run knockout-fixtures -- --stage r32 [--set "3C/D/F/G/H=France"] ...
 *
 * Resolvable automatically: "1A"/"2B" group slots (from final tables) and
 * "W74" winner slots (from knockout results). Third-place slots (e.g.
 * "3C/D/F/G/H") depend on FIFA's allocation table — resolve those manually with
 * --set, copying from the official bracket the moment it's published (5 minutes,
 * zero ambiguity). The script refuses to write a file with unresolved slots.
 */
import fs from "node:fs";
import path from "node:path";
import {
  fixturesByMatch,
  loadGroupOrderOverride,
  loadKnockoutTemplate,
  loadTeams,
  resultsByMatch,
} from "../lib/data";
import { groupTable } from "../lib/standings";
import type { Fixture, StageId } from "../lib/types";

const argv = process.argv.slice(2);
const stage = argv[argv.indexOf("--stage") + 1] as StageId;
if (!stage) {
  console.error("Usage: npm run knockout-fixtures -- --stage r32 [--set SLOT=Team]...");
  process.exit(1);
}

const manual = new Map<string, string>();
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--set") {
    const [slot, team] = argv[i + 1].split("=");
    manual.set(slot.trim(), team.trim());
  }
}

const teams = loadTeams();
const allFixtures = [...fixturesByMatch().values()];
const results = resultsByMatch();
const groupOverride = loadGroupOrderOverride();
const groups = [...new Set(teams.map((t) => t.group))].sort();
const tables = new Map(groups.map((g) => [g, groupTable(g, teams, allFixtures, results, groupOverride?.[g])]));

function resolve(slot: string): string | undefined {
  if (manual.has(slot)) return manual.get(slot);
  const groupPos = slot.match(/^([12])([A-L])$/); // "1A", "2K"
  if (groupPos) {
    const table = tables.get(groupPos[2]);
    const row = table?.[Number(groupPos[1]) - 1];
    const played = table?.every((r) => r.played === 3);
    return played ? row?.team : undefined;
  }
  const winner = slot.match(/^W(\d+)$/); // "W74"
  if (winner) {
    const r = results.get(Number(winner[1]));
    return r?.status === "final" ? r.advances : undefined;
  }
  return undefined; // third-place combination slots -> manual
}

const template = loadKnockoutTemplate().filter((s) => s.stage === stage);
if (template.length === 0) {
  console.error(`No template rows for stage "${stage}" in data/fixtures/knockout-template.json.`);
  process.exit(1);
}

const unresolved: string[] = [];
const fixtures: Fixture[] = template.map((s) => {
  const home = resolve(s.home_slot);
  const away = resolve(s.away_slot);
  if (!home) unresolved.push(`match ${s.match}: ${s.home_slot}`);
  if (!away) unresolved.push(`match ${s.match}: ${s.away_slot}`);
  return {
    match: s.match,
    stage: s.stage,
    home: home ?? s.home_slot,
    away: away ?? s.away_slot,
    kickoff_local: s.kickoff_local,
    tz: s.tz,
    kickoff_utc: s.kickoff_utc,
    city: s.city,
    stadium: s.stadium,
  };
});

if (unresolved.length > 0) {
  console.error(`Unresolved slots — pass --set "SLOT=Team" for each (copy from the official bracket):`);
  for (const u of unresolved) console.error(`  ${u}`);
  process.exit(1);
}

const file = path.join("data", "fixtures", `${stage}.json`);
fs.writeFileSync(file, JSON.stringify(fixtures, null, 2) + "\n", "utf-8");
console.log(`Wrote ${file} (${fixtures.length} fixtures):`);
for (const f of fixtures) console.log(`  ${f.match}: ${f.home} vs ${f.away} (${f.kickoff_utc}, ${f.city})`);
console.log(`\nVERIFY against the official bracket, then: npm run predict -- --stage ${stage}`);
