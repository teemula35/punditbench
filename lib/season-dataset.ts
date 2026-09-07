import { loadCompetitions } from "./data";
import { loadSeasonPredictions, verifySeasonHashLock } from "./season-prediction";
import { GITHUB_URL, SITE_NAME, SITE_URL } from "./site";

export const SEASON_DATASET_PATH = "/datasets/season-tables-2026-27/";
export const SEASON_DATASET_URL = `${SITE_URL}${SEASON_DATASET_PATH}`;
export const SEASON_DATASET_NAME =
  "PunditBench 2026–27 pre-registered LLM season-table forecasts";
export const SEASON_DATASET_DESCRIPTION =
  "204 complete final-table forecasts from 43 distinct language models across the Premier League, La Liga, Serie A, Ligue 1 and Bundesliga, with 40–42 forecasts per league. Every forecast was locked before its league's opening kickoff, with public Git commits, tags and SHA-256 locks.";

export const SEASON_DATASET_SOURCE_COMMIT = "fbd3b38ec27f6a699ebaffb6c062b8826481b77c";
export const SEASON_DATASET_SOURCE_URL =
  `${GITHUB_URL}/tree/${SEASON_DATASET_SOURCE_COMMIT}/data/competitions`;

export const SEASON_DATASET_COMPETITION_IDS = [
  "epl-2026-27",
  "laliga-2026-27",
  "seriea-2026-27",
  "ligue1-2026-27",
  "bundesliga-2026-27",
] as const;

const SEASON_DATASET_SOURCE_TAGS: Record<
  (typeof SEASON_DATASET_COMPETITION_IDS)[number],
  string
> = {
  "epl-2026-27": "predictions-epl-2026-27-season",
  "laliga-2026-27": "predictions-laliga-2026-27-season",
  "seriea-2026-27": "predictions-seriea-2026-27-season",
  "ligue1-2026-27": "predictions-ligue1-2026-27-season",
  "bundesliga-2026-27": "predictions-bundesliga-2026-27-season",
};

export const SEASON_DATASET_MIRRORS = {
  huggingFace: "https://huggingface.co/datasets/skebbe/punditbench-2026-27-season-tables",
  kaggle:
    "https://www.kaggle.com/datasets/teemulaurila/punditbench-2026-27-llm-season-tables",
} as const;

export const SEASON_DATASET_DOWNLOADS = {
  jsonl:
    "https://huggingface.co/datasets/skebbe/punditbench-2026-27-season-tables/resolve/fd234b7277b7f31ed593157b861cf680faa1347b/data/punditbench-season-tables-2026-27.jsonl?download=true",
  kaggleArchive:
    "https://www.kaggle.com/api/v1/datasets/download/teemulaurila/punditbench-2026-27-llm-season-tables?datasetVersionNumber=1",
} as const;

export interface SeasonDatasetLeague {
  id: string;
  name: string;
  shortName: string;
  forecastCount: number;
  sourceUrl: string;
}

export interface SeasonDatasetSummary {
  forecastCount: number;
  distinctModelCount: number;
  leagues: SeasonDatasetLeague[];
}

export function loadSeasonDatasetSummary(): SeasonDatasetSummary {
  const competitions = new Map(
    loadCompetitions().map((competition) => [competition.id, competition]),
  );
  const distinctModels = new Set<string>();
  const leagues = SEASON_DATASET_COMPETITION_IDS.map((id) => {
    const competition = competitions.get(id);
    if (!competition) throw new Error(`Season dataset competition is missing: ${id}`);
    const predictions = loadSeasonPredictions(id);
    const lock = verifySeasonHashLock(id);

    for (const prediction of predictions) {
      if (prediction.competition !== id) {
        throw new Error(`${id}: season dataset contains prediction for ${prediction.competition}`);
      }
      if (
        prediction.table.length !== competition.team_count ||
        new Set(prediction.table).size !== competition.team_count
      ) {
        throw new Error(`${id}: ${prediction.model} does not contain a complete unique table`);
      }
      distinctModels.add(prediction.model);
    }

    return {
      id,
      name: competition.name,
      shortName: competition.short_name,
      forecastCount: lock.models,
      sourceUrl: `${GITHUB_URL}/tree/${SEASON_DATASET_SOURCE_TAGS[id]}/data/competitions/${id}/predictions-season`,
    };
  });

  return {
    forecastCount: leagues.reduce((total, league) => total + league.forecastCount, 0),
    distinctModelCount: distinctModels.size,
    leagues,
  };
}

export function seasonDatasetJsonLd(summary = loadSeasonDatasetSummary()) {
  return {
    "@context": "https://schema.org/",
    "@type": "Dataset",
    name: SEASON_DATASET_NAME,
    description: SEASON_DATASET_DESCRIPTION,
    url: SEASON_DATASET_URL,
    sameAs: Object.values(SEASON_DATASET_MIRRORS),
    isBasedOn: SEASON_DATASET_SOURCE_URL,
    creator: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    isAccessibleForFree: true,
    keywords: [
      "LLM evaluation",
      "football forecasting",
      "pre-registered predictions",
      "Premier League",
      "La Liga",
      "Serie A",
      "Ligue 1",
      "Bundesliga",
    ],
    measurementTechnique: `${SITE_URL}/methodology/`,
    variableMeasured: [
      "Predicted final league position",
      "Predicted league champion",
      "Language model identifier",
      "Forecast request and completion timestamps",
      "Pre-registration Git tag and SHA-256 lock",
    ],
    version: "2026–27 locked pre-season snapshot",
    copyrightNotice:
      "No reuse license has been granted. Contact the repository owner before reuse beyond inspection and citation.",
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/x-ndjson",
        contentUrl: SEASON_DATASET_DOWNLOADS.jsonl,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/zip",
        contentUrl: SEASON_DATASET_DOWNLOADS.kaggleArchive,
      },
    ],
    hasPart: summary.leagues.map((league) => ({
      "@type": "Dataset",
      name: `${league.name} pre-registered season-table forecasts`,
      description: `${league.forecastCount} complete language-model final-table forecasts for the ${league.name}, locked before the league's opening kickoff.`,
      url: `${SITE_URL}/leagues/${league.id}/`,
      sameAs: league.sourceUrl,
    })),
  };
}
