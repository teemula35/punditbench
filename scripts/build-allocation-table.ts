/**
 * One-off provenance script: convert annexe_c_table.csv (parsed from FIFA's
 * "Regulations for the FIFA World Cup 26", Annexe C — see ALLOCATION-NOTES.md)
 * into data/third-allocation.json:
 *   { "<8 qualified group letters, sorted>": { "<match>": "<group whose third plays it>" } }
 * Validates completeness (all 495 subsets exactly once) before writing.
 */
import fs from "node:fs";

const COLUMNS: Record<string, number> = {
  M79_vs_1A: 79, M85_vs_1B: 85, M81_vs_1D: 81, M74_vs_1E: 74,
  M82_vs_1G: 82, M77_vs_1I: 77, M87_vs_1K: 87, M80_vs_1L: 80,
};

const lines = fs.readFileSync("annexe_c_table.csv", "utf-8").trim().split(/\r?\n/);
const header = lines[0].split(",");
const out: Record<string, Record<string, string>> = {};

for (const line of lines.slice(1)) {
  const cells = line.split(",");
  const key = [...cells[header.indexOf("qualified_groups")]].sort().join("");
  if (out[key]) throw new Error(`duplicate combination ${key}`);
  const assignment: Record<string, string> = {};
  for (const [col, match] of Object.entries(COLUMNS)) {
    const v = cells[header.indexOf(col)].trim();
    if (!/^[A-L]$/.test(v)) throw new Error(`bad cell ${col}=${v} in row ${cells[0]}`);
    assignment[String(match)] = v;
  }
  const assigned = Object.values(assignment).sort().join("");
  if (assigned !== key) throw new Error(`row ${cells[0]}: assigned groups ${assigned} != qualified ${key}`);
  out[key] = assignment;
}

// Completeness: every 8-subset of {A..L} exactly once.
const groups = [..."ABCDEFGHIJKL"];
const subsets: string[] = [];
const gen = (start: number, acc: string[]): void => {
  if (acc.length === 8) { subsets.push(acc.join("")); return; }
  for (let i = start; i < groups.length; i++) gen(i + 1, [...acc, groups[i]]);
};
gen(0, []);
if (subsets.length !== 495) throw new Error("subset enumeration bug");
for (const s of subsets) if (!out[s]) throw new Error(`missing combination ${s}`);
if (Object.keys(out).length !== 495) throw new Error(`expected 495 rows, got ${Object.keys(out).length}`);

fs.writeFileSync("data/third-allocation.json", JSON.stringify(out, null, 1) + "\n", "utf-8");
console.log("data/third-allocation.json written: 495 combinations, all validated.");
