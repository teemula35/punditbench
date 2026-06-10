/**
 * One-off A2 reconciliation: diff the canonical group fixtures (Wikipedia-based)
 * against the independently-built verification set (ESPN/Sky/FOX/roadtrips).
 * Compares per match number: group, normalized team pairing + order, local date.
 *
 *   node --import tsx scripts/reconcile-fixtures.ts
 */
import fs from "node:fs";
import path from "node:path";
import type { Fixture } from "../lib/types";

interface VerifyRow {
  match?: number;
  group: string;
  home: string;
  away: string;
  date_local: string;
  city: string;
  kickoff_note?: string;
}

const read = <T>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", rel), "utf-8")) as T;

const canonical = read<Fixture[]>("fixtures/group.json");
const verify = read<VerifyRow[]>("fixtures/group.verify.json");

/** Normalize naming-convention differences between sources. */
const ALIASES: Record<string, string> = {
  "czech republic": "czechia",
  "turkey": "türkiye",
  "korea republic": "south korea",
  "republic of korea": "south korea",
  "ir iran": "iran",
  "usa": "united states",
  "côte d'ivoire": "ivory coast",
  "cote d'ivoire": "ivory coast",
  "cabo verde": "cape verde",
  "bosnia-herzegovina": "bosnia and herzegovina",
  "dr congo": "democratic republic of the congo",
  "congo dr": "democratic republic of the congo",
  "uae": "united arab emirates",
};
const norm = (s: string): string => {
  const k = s.trim().toLowerCase();
  return ALIASES[k] ?? k;
};

let issues = 0;
const flag = (msg: string): void => {
  issues++;
  console.log(`MISMATCH: ${msg}`);
};

if (verify.length !== 72) flag(`verification set has ${verify.length} rows, expected 72`);

const byMatch = new Map(canonical.map((f) => [f.match, f]));
const matched = new Set<number>();

for (const v of verify) {
  let c: Fixture | undefined;
  if (v.match !== undefined) {
    c = byMatch.get(v.match);
    if (!c) {
      flag(`verify match ${v.match} not in canonical set`);
      continue;
    }
  } else {
    c = canonical.find(
      (f) =>
        !matched.has(f.match) &&
        norm(f.home) === norm(v.home) &&
        norm(f.away) === norm(v.away),
    );
    if (!c) {
      flag(`verify row ${v.home} vs ${v.away} (${v.date_local}) has no canonical counterpart`);
      continue;
    }
  }
  matched.add(c.match);

  if (norm(c.home) !== norm(v.home) || norm(c.away) !== norm(v.away)) {
    if (norm(c.home) === norm(v.away) && norm(c.away) === norm(v.home)) {
      flag(`match ${c.match}: home/away ORDER differs — canonical ${c.home} vs ${c.away}, verify ${v.home} vs ${v.away}`);
    } else {
      flag(`match ${c.match}: teams differ — canonical ${c.home} vs ${c.away}, verify ${v.home} vs ${v.away}`);
    }
    continue;
  }
  if ((c.group ?? "") !== v.group) {
    flag(`match ${c.match}: group differs — canonical ${c.group}, verify ${v.group}`);
  }
  const cDate = (c.kickoff_local ?? c.kickoff_utc).slice(0, 10);
  if (cDate !== v.date_local) {
    flag(`match ${c.match} (${c.home} vs ${c.away}): local date differs — canonical ${cDate}, verify ${v.date_local}`);
  }
}

for (const f of canonical) {
  if (!matched.has(f.match)) flag(`canonical match ${f.match} (${f.home} vs ${f.away}) missing from verification set`);
}

console.log(
  issues === 0
    ? `RECONCILED: all 72 fixtures agree across the two independent source sets (pairing, order, group, local date).`
    : `\n${issues} issue(s) — adjudicate against a third source before the prediction run.`,
);
process.exitCode = issues === 0 ? 0 : 1;
