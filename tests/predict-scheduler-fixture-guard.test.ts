import fs from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = fs.readFileSync(".github/workflows/predict-scheduler.yml", "utf-8");
const predictor = fs.readFileSync("scripts/league-predict.ts", "utf-8");
const refresher = fs.readFileSync("scripts/league-fixtures.ts", "utf-8");

describe("predict scheduler fixture-clean guard wiring", () => {
  it("keeps fixture refresh and due prediction sequential in the same job", () => {
    const refreshStep = workflow.indexOf("- name: Refresh league fixtures");
    const predictStep = workflow.indexOf("- name: Lock due league picks");
    expect(refreshStep).toBeGreaterThan(0);
    expect(refreshStep).toBeLessThan(predictStep);
    expect(workflow).toContain("continue-on-error: true");
  });

  it("emits an affirmative clean competition list only after the refresh batch", () => {
    expect(refresher).toContain('setOutput("clean_competitions", encodeCleanCompetitions');
    const batchCall = refresher.indexOf("await runRefreshBatch(");
    const attestationWrite = refresher.indexOf("writeCleanCompetitionAttestation(");
    const outputWrite = refresher.indexOf('setOutput("clean_competitions"');
    expect(batchCall).toBeGreaterThan(0);
    expect(batchCall).toBeLessThan(attestationWrite);
    expect(attestationWrite).toBeLessThan(outputWrite);
  });

  it("partitions mutation-capable due targets before credentials and model calls", () => {
    const guard = predictor.indexOf("guardDueTargets(");
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(predictor.indexOf("OPENROUTER_API_KEY missing"));
    expect(guard).toBeLessThan(predictor.indexOf("await runRound("));
    expect(predictor).toContain("loadCleanCompetitionAttestation()");
    expect(predictor).toContain("fixture refresh was not affirmatively clean; skipped before model calls");
  });
});
