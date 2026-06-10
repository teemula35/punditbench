/**
 * Display shaping of a model's stored bracket simulation for the model pages:
 * stage-by-stage simulated pairings with the model's predicted scorelines and
 * advancers, plus its champion. Pure derivation from stored prediction files —
 * pairings are read from `simulated_fixtures` exactly as collected, never
 * recomputed.
 */
import { modelReach } from "./bracket-scoring";
import type { Prediction, PredictionFile, StageId } from "./types";
import { KNOCKOUT_STAGES } from "./types";

export interface SimMatchView {
  /** Structural bracket slot 73-104 (shared with the real tournament). */
  match: number;
  home: string;
  away: string;
  /** The model's stored prediction for this simulated pairing, if valid. */
  prediction?: Prediction;
  /** Team the model advances: explicit `advances`, else implied by the score. */
  advances?: string;
  /** Predicted 90-minute draw — the advancer was decided beyond 90 minutes. */
  isDraw: boolean;
}

export interface BracketView {
  /** Knockout stage -> simulated pairings, only for stages already collected. */
  stages: Map<StageId, SimMatchView[]>;
  /** The model's predicted world champion (advancer of its simulated final). */
  champion?: string;
  /** Knockout stages without a stored simulation yet. */
  pendingStages: StageId[];
}

/** A model's complete simulated knockout bracket, shaped for rendering. */
export function bracketView(files: PredictionFile[]): BracketView {
  const stages = new Map<StageId, SimMatchView[]>();

  for (const stage of KNOCKOUT_STAGES) {
    const file = files.find((f) => f.stage === stage);
    if (!file?.simulated_fixtures) continue;
    const predictions = new Map(file.predictions.map((p) => [p.match, p]));
    const matches = [...file.simulated_fixtures]
      .sort((a, b) => a.match - b.match)
      .map((f): SimMatchView => {
        const prediction = predictions.get(f.match);
        const isDraw = prediction !== undefined && prediction.home_goals === prediction.away_goals;
        const advances =
          prediction === undefined
            ? undefined
            : (prediction.advances ??
              (prediction.home_goals > prediction.away_goals
                ? f.home
                : prediction.away_goals > prediction.home_goals
                  ? f.away
                  : undefined));
        return { match: f.match, home: f.home, away: f.away, prediction, advances, isDraw };
      });
    stages.set(stage, matches);
  }

  const championSet = modelReach(files).byStage.get("champion");
  return {
    stages,
    champion: championSet && championSet.size > 0 ? [...championSet][0] : undefined,
    pendingStages: KNOCKOUT_STAGES.filter((s) => !stages.has(s)),
  };
}
