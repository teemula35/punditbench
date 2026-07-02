/**
 * Canonical prediction hashing (A6 pre-registration) — shared by the WC hash
 * script and the league predict pipeline so there is exactly one definition of
 * the canonical form.
 *
 * Canonical form v2: JSON array of {slug, model, stage, completed_at,
 * simulated_fixtures? (sorted by match), predictions (sorted by match)},
 * sorted by (slug, stage), no whitespace.
 */
import crypto from "node:crypto";
import type { PredictionFile } from "./types";

export function canonicalPayload(files: PredictionFile[]): string {
  const canonical = [...files]
    .sort((a, b) => a.slug.localeCompare(b.slug) || a.stage.localeCompare(b.stage))
    .map((f) => ({
      slug: f.slug,
      model: f.model,
      stage: f.stage,
      completed_at: f.completed_at,
      // Simulated stages: the model's own pairings are part of the claim.
      ...(f.simulated_fixtures
        ? { simulated_fixtures: [...f.simulated_fixtures].sort((a, b) => a.match - b.match) }
        : {}),
      predictions: [...f.predictions].sort((a, b) => a.match - b.match),
    }));
  return JSON.stringify(canonical);
}

export function sha256(payload: string): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}
