import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  encodeCleanCompetitions,
  fixtureAttestationPath,
  guardDueTargets,
  loadCleanCompetitionAttestation,
  runRefreshBatch,
  writeCleanCompetitionAttestation,
} from "../lib/league-refresh-guard";

interface Target {
  comp: { id: string };
  round: string;
}
const targets: Target[] = [
  { comp: { id: "epl-2026-27" }, round: "md01" },
  { comp: { id: "ligue1-2026-27" }, round: "md01" },
];

describe("fixture-clean competition attestation", () => {
  it("allows only due competitions affirmatively attested clean in this run", () => {
    const result = guardDueTargets(targets, '["epl-2026-27"]');
    expect(result.allowed.map((target) => target.comp.id)).toEqual(["epl-2026-27"]);
    expect(result.blocked.map((target) => target.comp.id)).toEqual(["ligue1-2026-27"]);
    expect(result.error).toBeUndefined();
  });

  it.each([undefined, "", "not json", "{}", '["epl-2026-27", 7]', '["epl-2026-27", "epl-2026-27"]']) (
    "fails closed for missing or malformed attestation %j",
    (raw) => {
      const result = guardDueTargets(targets, raw);
      expect(result.allowed).toEqual([]);
      expect(result.blocked).toEqual(targets);
      expect(result.error).toMatch(/attestation/i);
    },
  );

  it("encodes a stable, unique JSON allowlist", () => {
    expect(encodeCleanCompetitions(["seriea-2026-27", "epl-2026-27", "epl-2026-27"])).toBe(
      '["epl-2026-27","seriea-2026-27"]',
    );
  });

  it("shares the attestation through a run-scoped atomic file on GitHub Actions", () => {
    const runnerTemp = fs.mkdtempSync(path.join(os.tmpdir(), "pb-fixture-guard-"));
    const env = {
      RUNNER_TEMP: runnerTemp,
      GITHUB_RUN_ID: "123456",
      GITHUB_RUN_ATTEMPT: "2",
    };
    const expectedPath = path.join(runnerTemp, "punditbench-fixture-clean-123456-2.json");
    expect(fixtureAttestationPath(env)).toBe(expectedPath);
    expect(loadCleanCompetitionAttestation(env)).toBeUndefined();
    expect(writeCleanCompetitionAttestation(["ligue1-2026-27", "epl-2026-27"], env)).toBe(true);
    expect(loadCleanCompetitionAttestation(env)).toBe(
      '["epl-2026-27","ligue1-2026-27"]',
    );
    fs.rmSync(runnerTemp, { recursive: true, force: true });
  });

  it("prefers an explicit local attestation and has no unscoped fallback file", () => {
    expect(
      loadCleanCompetitionAttestation({ PB_LEAGUE_FIXTURE_CLEAN_COMPETITIONS: '["epl-2026-27"]' }),
    ).toBe('["epl-2026-27"]');
    expect(fixtureAttestationPath({ RUNNER_TEMP: os.tmpdir() })).toBeUndefined();
  });

  it("continues after one competition throws and attests only later clean competitions", async () => {
    const seen: string[] = [];
    const result = await runRefreshBatch(
      [{ id: "broken" }, { id: "clean" }, { id: "not-ready" }],
      async (comp) => {
        seen.push(comp.id);
        if (comp.id === "broken") throw new Error("network down");
        if (comp.id === "not-ready") return { ok: true, clean: false };
        return { ok: true, clean: true };
      },
    );
    expect(seen).toEqual(["broken", "clean", "not-ready"]);
    expect(result.cleanCompetitionIds).toEqual(["clean"]);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(["broken: network down"]);
  });
});
