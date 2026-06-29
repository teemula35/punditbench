import fs from "node:fs";
import path from "node:path";
import type {
  Fixture,
  KnockoutSlot,
  LiveManifest,
  MatchResult,
  PredictionFile,
  RosterModel,
  StageId,
  Team,
} from "./types";
import { KNOCKOUT_STAGES } from "./types";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA, rel), "utf-8")) as T;
}

function readJsonIfExists<T>(rel: string): T | undefined {
  const p = path.join(DATA, rel);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf-8")) as T) : undefined;
}

export function loadTeams(): Team[] {
  return readJson<Team[]>("teams.json");
}

export function loadRoster(): RosterModel[] {
  return readJson<RosterModel[]>("roster.json");
}

export function loadKnockoutTemplate(): KnockoutSlot[] {
  return readJson<KnockoutSlot[]>(path.join("fixtures", "knockout-template.json"));
}

/** All fixtures from every stage file that exists so far, sorted by match number. */
export function loadFixtures(): Fixture[] {
  const stages: StageId[] = ["group", ...KNOCKOUT_STAGES];
  const all: Fixture[] = [];
  for (const stage of stages) {
    const fixtures = readJsonIfExists<Fixture[]>(path.join("fixtures", `${stage}.json`));
    if (fixtures) all.push(...fixtures.map((f) => ({ ...f, stage })));
  }
  return all.sort((a, b) => a.match - b.match);
}

export function loadStageFixtures(stage: StageId): Fixture[] {
  const fixtures = readJson<Fixture[]>(path.join("fixtures", `${stage}.json`));
  return fixtures.map((f) => ({ ...f, stage })).sort((a, b) => a.match - b.match);
}

export function loadResults(): MatchResult[] {
  return readJsonIfExists<MatchResult[]>("results.json") ?? [];
}

export function resultsByMatch(): Map<number, MatchResult> {
  return new Map(loadResults().map((r) => [r.match, r]));
}

export function fixturesByMatch(): Map<number, Fixture> {
  return new Map(loadFixtures().map((f) => [f.match, f]));
}

/** All stored prediction files for one model slug. */
export function loadPredictionsForModel(slug: string): PredictionFile[] {
  const out: PredictionFile[] = [];
  const dir = path.join(DATA, "predictions");
  if (!fs.existsSync(dir)) return out;
  for (const stage of fs.readdirSync(dir)) {
    const file = path.join(dir, stage, `${slug}.json`);
    if (fs.existsSync(file)) out.push(JSON.parse(fs.readFileSync(file, "utf-8")) as PredictionFile);
  }
  return out;
}

/** slug -> prediction files, reading one predictions tree (locked or live). */
function loadPredictionsTree(dir: string): Map<string, PredictionFile[]> {
  const out = new Map<string, PredictionFile[]>();
  if (!fs.existsSync(dir)) return out;
  for (const stage of fs.readdirSync(dir)) {
    const stageDir = path.join(dir, stage);
    if (!fs.statSync(stageDir).isDirectory()) continue; // skips manifest.json
    for (const f of fs.readdirSync(stageDir)) {
      if (!f.endsWith(".json")) continue;
      const slug = f.replace(/\.json$/, "");
      const file = JSON.parse(fs.readFileSync(path.join(stageDir, f), "utf-8")) as PredictionFile;
      const list = out.get(slug) ?? [];
      list.push(file);
      out.set(slug, list);
    }
  }
  return out;
}

/** slug -> prediction files, for every model that has any stored predictions. */
export function loadAllPredictions(): Map<string, PredictionFile[]> {
  return loadPredictionsTree(path.join(DATA, "predictions"));
}

/** slug -> round-by-round (live) prediction files for the real-fixture track. */
export function loadAllLivePredictions(): Map<string, PredictionFile[]> {
  return loadPredictionsTree(path.join(DATA, "predictions-live"));
}

/** One model's stored live (round-by-round) prediction files. */
export function loadLivePredictionsForModel(slug: string): PredictionFile[] {
  return loadAllLivePredictions().get(slug) ?? [];
}

/** Round-by-round track manifest (excluded matches + per-round lock metadata). */
export function loadLiveManifest(): LiveManifest {
  return (
    readJsonIfExists<LiveManifest>(path.join("predictions-live", "manifest.json")) ?? {
      excluded: {},
      rounds: {},
    }
  );
}

export function loadGroupOrderOverride(): Record<string, string[]> | undefined {
  return readJsonIfExists<Record<string, string[]>>(path.join("overrides", "group-order.json"));
}

export function loadThirdOrderOverride(): string[] | undefined {
  return readJsonIfExists<string[]>(path.join("overrides", "third-order.json"));
}

/** FIFA Annexe C: sorted 8-group key -> { match -> group whose third plays it }. */
export function loadThirdAllocationTable(): Record<string, Record<string, string>> {
  return readJson<Record<string, Record<string, string>>>("third-allocation.json");
}

export function writeResults(results: MatchResult[]): void {
  results.sort((a, b) => a.match - b.match);
  fs.writeFileSync(path.join(DATA, "results.json"), JSON.stringify(results, null, 2) + "\n", "utf-8");
}
