/**
 * League round-by-round prediction runner (the form-aware live track).
 *
 *   npm run league-predict -- --comp epl-2026-27 --round md01 [--models all|id1,id2] [--mock] [--dry-run] [--only-missing]
 *   npm run league-predict -- --due [--mock]     # scheduler mode: lock every due round (T-36h window)
 *
 * Per round: builds ONE form-aware prompt for all models (current table +
 * last-5 form derived from our own synced results; previous-season context
 * before matchday 1), runs the roster via lib/runner.ts into
 * data/competitions/<id>/predictions-live/<round>/ (+ raw-live audit logs),
 * auto-excludes matches that already kicked off (recorded in the manifest
 * with a reason — the WC match-73 precedent), refuses to re-run an already
 * locked round (idempotent for the daily scheduler; --only-missing fills
 * gaps), writes the round's canonical hash, and emits GitHub outputs
 * (changed / locked / tags / alerts) for predict-scheduler.yml.
 */
import fs from "node:fs";
import path from "node:path";
import {
  activeCompetitions,
  competitionDataRoot,
  getCompetition,
  loadCompetitionFixtures,
  loadCompetitionLiveManifest,
  loadCompetitionLivePredictions,
  loadCompetitionResults,
  loadRoster,
} from "../lib/data";
import { canonicalPayload, sha256 } from "../lib/hashing";
import { formByTeam, leagueTable, loadPreviousSeason, restDaysByTeam } from "../lib/league-context";
import { splitRoundByKickoff } from "../lib/league-fixtures";
import { buildLeaguePrompt, LEAGUE_PROMPT_VERSION } from "../lib/league-prompt";
import { dueRounds } from "../lib/league-schedule";
import { modelSlug } from "../lib/prompt";
import { loadEnv, runModelOnFixtures } from "../lib/runner";
import { isMatchdayKey } from "../lib/types";
import type { Competition, MatchdayKey } from "../lib/types";

const CONCURRENCY = 4;
const EXCLUDE_REASON = "Kicked off before this round's picks were collected.";

interface Args {
  comp?: string;
  round?: string;
  due: boolean;
  models: string;
  mock: boolean;
  dryRun: boolean;
  onlyMissing: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const args: Args = {
    comp: get("--comp"),
    round: get("--round"),
    due: argv.includes("--due"),
    models: get("--models") ?? "all",
    mock: argv.includes("--mock"),
    dryRun: argv.includes("--dry-run"),
    onlyMissing: argv.includes("--only-missing"),
  };
  if (!args.due && (!args.comp || !args.round || !isMatchdayKey(args.round))) {
    console.error(
      "Usage: league-predict --comp <id> --round <mdNN> [--models ...] [--mock] [--dry-run] [--only-missing]\n" +
        "       league-predict --due [--mock]",
    );
    process.exit(1);
  }
  return args;
}

function setOutput(name: string, value: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  fs.appendFileSync(out, `${name}=${value.replace(/\r?\n/g, " ")}\n`);
}

/** Merge this round into the competition's live manifest (lock metadata + exclusions). */
function writeCompetitionLiveManifest(compId: string, round: MatchdayKey, excluded: number[]): void {
  const manifest = loadCompetitionLiveManifest(compId);
  const roundDir = path.join("data", "competitions", compId, "predictions-live", round);
  const models = fs.existsSync(roundDir)
    ? fs.readdirSync(roundDir).filter((f) => f.endsWith(".json")).length
    : 0;
  manifest.rounds[round] = { locked_at: new Date().toISOString(), models, excluded };
  for (const m of excluded) manifest.excluded[String(m)] = EXCLUDE_REASON;
  const dir = path.join("data", "competitions", compId, "predictions-live");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`Updated ${compId} live manifest (${round}, excluded [${excluded.join(", ")}]).`);
}

/** Canonical hash over the round's stored files (same form as scripts/hash.ts). */
function writeRoundHash(comp: Competition, round: MatchdayKey): { models: number; hash: string } | undefined {
  const files = [...loadCompetitionLivePredictions(comp.id).values()]
    .flat()
    .filter((f) => f.stage === round);
  if (files.length === 0) return undefined;
  const hash = sha256(canonicalPayload(files));
  const dir = path.join(process.cwd(), "data", "competitions", comp.id, "hashes");
  fs.mkdirSync(dir, { recursive: true });
  const record = [
    "track: round-by-round (live, real fixtures)",
    `competition: ${comp.id}`,
    `round: ${round}`,
    `models: ${files.length}`,
    `generated_at: ${new Date().toISOString()}`,
    `sha256: ${hash}`,
    "",
    "Canonical form v2: JSON array of {slug, model, stage, completed_at, simulated_fixtures?",
    "(sorted by match), predictions (sorted by match)}, sorted by (slug, stage), no whitespace.",
    `Recompute with: npm run hash -- --comp ${comp.id} --round ${round}`,
  ].join("\n");
  fs.writeFileSync(path.join(dir, `${round}-live.txt`), record + "\n", "utf-8");
  return { models: files.length, hash };
}

interface RoundOutcome {
  changed: boolean;
  locked?: string;
  tag?: string;
  alerts: string[];
}

async function runRound(comp: Competition, round: MatchdayKey, args: Args): Promise<RoundOutcome> {
  const out: RoundOutcome = { changed: false, alerts: [] };
  const allFixtures = loadCompetitionFixtures(comp.id);
  const roundFixtures = allFixtures.filter((f) => f.stage === round);
  if (roundFixtures.length === 0) {
    out.alerts.push(`${comp.id} ${round}: no fixtures for this round`);
    return out;
  }

  const manifest = loadCompetitionLiveManifest(comp.id);
  if (manifest.rounds[round] && !args.onlyMissing) {
    console.log(
      `${comp.id} ${round}: already locked at ${manifest.rounds[round]!.locked_at} — skipping (use --only-missing to fill gaps).`,
    );
    return out;
  }

  const { included, excluded } = splitRoundByKickoff(roundFixtures, new Date());
  const excludedMatches = excluded.map((f) => f.match);
  if (excluded.length > 0) {
    console.log(
      `${comp.id} ${round}: excluding ${excluded.length} already-kicked-off match(es) from pre-registration (${excludedMatches.join(", ")}).`,
    );
  }

  const results = loadCompetitionResults(comp.id);
  const prompt = buildLeaguePrompt(comp, round, included, {
    table: leagueTable(allFixtures, results),
    form: formByTeam(allFixtures, results),
    rest: restDaysByTeam(allFixtures, results, included),
    previousSeason: loadPreviousSeason(comp.id),
  });

  if (args.dryRun) {
    console.log(prompt);
    console.log(`\n--- dry run: ${comp.id} ${round}, ${included.length} fixtures, prompt ${prompt.length} chars ---`);
    return out;
  }

  if (included.length === 0) {
    // Whole round already kicked off (scheduler outage): lock it fully excluded
    // so the site shows "not pre-registered" and the scheduler moves on.
    writeCompetitionLiveManifest(comp.id, round, excludedMatches);
    out.changed = true;
    out.alerts.push(`${comp.id} ${round}: locked with ZERO picks — every match had already kicked off`);
    return out;
  }

  let roster = loadRoster();
  if (args.models !== "all") {
    const wanted = new Set(args.models.split(",").map((s) => s.trim()));
    roster = roster.filter((m) => wanted.has(m.id) || wanted.has(modelSlug(m.id)));
  }
  if (args.onlyMissing) {
    roster = roster.filter(
      (m) =>
        !fs.existsSync(
          path.join("data", "competitions", comp.id, "predictions-live", round, `${modelSlug(m.id)}.json`),
        ),
    );
  }
  if (roster.length === 0) {
    console.log(`${comp.id} ${round}: nothing to do (roster empty after filters).`);
    return out;
  }

  console.log(
    `league-predict — ${comp.name} ${round}: fixtures=${included.length}, models=${roster.length}, mock=${args.mock}, prompt=${LEAGUE_PROMPT_VERSION} (${prompt.length} chars)`,
  );

  const queue = [...roster];
  const outcomes: { slug: string; ok: boolean; attempts: number; error?: string; costUsd?: number }[] = [];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let m = queue.shift(); m; m = queue.shift()) {
        const started = Date.now();
        const o = await runModelOnFixtures(m, modelSlug(m.id), round, included, prompt, {
          mock: args.mock,
          promptVersion: LEAGUE_PROMPT_VERSION,
          variant: "live",
          dataRoot: competitionDataRoot(comp.id),
        });
        outcomes.push(o);
        console.log(
          `${o.ok ? "OK  " : "FAIL"} ${o.slug} (attempts=${o.attempts}, ${Math.round((Date.now() - started) / 1000)}s${o.costUsd !== undefined ? `, $${o.costUsd.toFixed(4)}` : ""}${o.error ? `, ${o.error.slice(0, 160)}` : ""})`,
        );
      }
    }),
  );

  const failed = outcomes.filter((o) => !o.ok);
  const cost = outcomes.reduce((s, o) => s + (o.costUsd ?? 0), 0);
  console.log(
    `\n${comp.id} ${round}: ${outcomes.length - failed.length}/${outcomes.length} models OK. Total cost: $${cost.toFixed(2)}`,
  );
  for (const f of failed) {
    out.alerts.push(`MODEL FAILED [${comp.id} ${round}]: ${f.slug} (${(f.error ?? "").slice(0, 120)})`);
  }

  writeCompetitionLiveManifest(comp.id, round, excludedMatches);
  const hashInfo = writeRoundHash(comp, round);
  if (hashInfo) console.log(`sha256 ${hashInfo.hash.slice(0, 16)}… over ${hashInfo.models} model file(s)`);
  out.changed = true;
  out.locked = `${comp.id} ${round} (${hashInfo?.models ?? 0} models)`;
  out.tag = `predictions-${comp.id}-${round}-live`;
  return out;
}

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs();

  let targets: { comp: Competition; round: MatchdayKey }[];
  if (args.due) {
    const inputs = activeCompetitions().map((c) => ({
      compId: c.id,
      fixtures: loadCompetitionFixtures(c.id),
      manifest: loadCompetitionLiveManifest(c.id),
    }));
    targets = dueRounds(inputs, new Date()).map((d) => ({
      comp: getCompetition(d.compId),
      round: d.round,
    }));
    if (targets.length === 0) console.log("No rounds due within the lock window.");
  } else {
    targets = [{ comp: getCompetition(args.comp!), round: args.round as MatchdayKey }];
  }

  if (targets.length > 0 && !args.mock && !args.dryRun && !process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY missing. Copy .env.example to .env and set it.");
    process.exit(1);
  }

  let changed = false;
  const locked: string[] = [];
  const tags: string[] = [];
  const alerts: string[] = [];
  for (const t of targets) {
    const o = await runRound(t.comp, t.round, args);
    changed = changed || o.changed;
    if (o.locked) locked.push(o.locked);
    if (o.tag) tags.push(o.tag);
    alerts.push(...o.alerts);
  }

  for (const a of alerts) console.log(`ALERT: ${a}`);
  setOutput("changed", String(changed));
  setOutput("locked", locked.join("; "));
  setOutput("tags", tags.join(" "));
  setOutput("alerts", alerts.join("; "));
  if (changed && !process.env.GITHUB_OUTPUT) {
    console.log(
      `\nNext (manual run): git add -A; git commit; ${tags.map((t) => `git tag -a ${t} -m "pre-registration lock"`).join("; ")}; git push --follow-tags; deploy`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
