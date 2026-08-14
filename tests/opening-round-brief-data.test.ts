import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAllLivePredictions, loadResults, loadRoster, loadStageFixtures } from "../lib/data";
import { scoreMatch } from "../lib/scoring";

const samplePath = path.join(process.cwd(), "content", "briefs", "opening-round-2026-sample.md");

// Git checkouts on Windows deliver CRLF; the assertions below match against \n
// blank lines and would capture stray \r into groups otherwise.
const readText = (filePath: string) => fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");

describe("opening-round brief sample evidence", () => {
  it("keeps the published R16 scorecard aligned with the locked files", () => {
    const fixtures = new Map(loadStageFixtures("r16").map((fixture) => [fixture.match, fixture]));
    const results = new Map(loadResults().map((result) => [result.match, result]));
    const files = [...loadAllLivePredictions().values()]
      .flat()
      .filter((file) => file.stage === "r16");
    const scores = files.flatMap((file) =>
      file.predictions.map((prediction) =>
        scoreMatch(prediction, results.get(prediction.match)!, fixtures.get(prediction.match)!)!,
      ),
    );

    const count = (breakdown: string) => scores.filter((score) => score.breakdown === breakdown).length;
    const basePoints = scores.reduce((total, score) => total + score.points - score.advance_bonus, 0);
    const advancePoints = scores.reduce((total, score) => total + score.advance_bonus, 0);
    const sample = readText(samplePath);

    expect(loadRoster()).toHaveLength(40);
    expect(files).toHaveLength(38);
    expect(scores).toHaveLength(304);
    expect({
      exact: count("exact"),
      goalDifference: count("gd"),
      outcome: count("outcome"),
      miss: count("none"),
      correctAdvancers: scores.filter((score) => score.advance_bonus === 1).length,
      basePoints,
      advancePoints,
    }).toEqual({
      exact: 1,
      goalDifference: 81,
      outcome: 85,
      miss: 137,
      correctAdvancers: 195,
      basePoints: 250,
      advancePoints: 195,
    });
    expect(sample).toContain("| Valid model-match predictions | 304 (38 × 8) |");
    expect(sample).toContain("| Total points across the round | 445 |");
  });

  it("attributes the R16 manifest lock and hash metadata to their source files", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "predictions-live", "manifest.json"), "utf8"),
    ) as { rounds: { r16: { locked_at: string } } };
    const hashRecord = readText(path.join(process.cwd(), "data", "hashes", "r16-live.txt"));
    const hashValues = {
      track: hashRecord.match(/^track: (.+)$/m)?.[1],
      stage: hashRecord.match(/^stage: (.+)$/m)?.[1],
      models: hashRecord.match(/^models: (.+)$/m)?.[1],
      generatedAt: hashRecord.match(/^generated_at: (.+)$/m)?.[1],
      digest: hashRecord.match(/^sha256: ([a-f0-9]{64})$/m)?.[1],
    };
    const sample = readText(samplePath);
    const audit = sample.match(
      /## 4\. Lock and hash audit\n\n([\s\S]*?)\n\nGit records the annotated tag/,
    )?.[1];

    expect(manifest.rounds.r16.locked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.values(hashValues)).not.toContain(undefined);
    expect(hashValues.digest).toHaveLength(64);
    expect(audit).toBe(
      [
        "The live manifest at",
        "[/data/predictions-live/manifest.json](/data/predictions-live/manifest.json) says:",
        "",
        `- manifest lock: \`${manifest.rounds.r16.locked_at}\`;`,
        "",
        "The stored integrity record at [/data/hashes/r16-live.txt](/data/hashes/r16-live.txt) says:",
        "",
        `- track: \`${hashValues.track}\`;`,
        `- stage: \`${hashValues.stage}\`;`,
        `- models: ${hashValues.models};`,
        `- digest generated: \`${hashValues.generatedAt}\`;`,
        "- SHA-256:",
        `  \`${hashValues.digest}\`.`,
      ].join("\n"),
    );
  });
});
