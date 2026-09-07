import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SeasonDatasetPage, { metadata } from "../app/datasets/season-tables-2026-27/page";
import {
  loadSeasonDatasetSummary,
  SEASON_DATASET_DESCRIPTION,
  SEASON_DATASET_DOWNLOADS,
  SEASON_DATASET_MIRRORS,
  SEASON_DATASET_PATH,
  SEASON_DATASET_SOURCE_URL,
  SEASON_DATASET_URL,
} from "../lib/season-dataset";

function jsonLdFrom(html: string): Record<string, unknown> {
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
  if (!match) throw new Error("Dataset JSON-LD script was not rendered");
  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe("season-table dataset landing page", () => {
  it("derives the immutable snapshot counts from the public source files", () => {
    const summary = loadSeasonDatasetSummary();

    expect(summary.forecastCount).toBe(204);
    expect(summary.distinctModelCount).toBe(43);
    expect(
      Object.fromEntries(summary.leagues.map((league) => [league.id, league.forecastCount])),
    ).toEqual({
      "epl-2026-27": 40,
      "laliga-2026-27": 40,
      "seriea-2026-27": 42,
      "ligue1-2026-27": 40,
      "bundesliga-2026-27": 42,
    });
  });

  it("renders the two mirrors, direct downloads, integrity links and reuse boundary", () => {
    const html = renderToStaticMarkup(<SeasonDatasetPage />);

    expect(html).toContain("204 complete final-table forecasts");
    expect(html).toContain(SEASON_DATASET_DOWNLOADS.jsonl);
    expect(html).toContain(SEASON_DATASET_DOWNLOADS.kaggleArchive);
    expect(html).toContain("No reuse license has been granted");
    expect(html).toContain("No table was added later to fill a gap");
    expect(html).toContain("For adults (18+)");
  });

  it("publishes Google-supported Dataset JSON-LD without inventing a reuse license", () => {
    const schema = jsonLdFrom(renderToStaticMarkup(<SeasonDatasetPage />));
    const distributions = schema.distribution as Array<Record<string, unknown>>;
    const parts = schema.hasPart as Array<Record<string, unknown>>;

    expect(schema["@context"]).toBe("https://schema.org/");
    expect(schema["@type"]).toBe("Dataset");
    expect(schema.name).toBe("PunditBench 2026–27 pre-registered LLM season-table forecasts");
    expect(schema.description).toBe(SEASON_DATASET_DESCRIPTION);
    expect(SEASON_DATASET_DESCRIPTION).toContain("43 distinct language models");
    expect(SEASON_DATASET_DESCRIPTION.length).toBeGreaterThanOrEqual(50);
    expect(schema.url).toBe(SEASON_DATASET_URL);
    expect(schema.sameAs).toEqual(Object.values(SEASON_DATASET_MIRRORS));
    expect(schema.isBasedOn).toBe(SEASON_DATASET_SOURCE_URL);
    expect(schema.isAccessibleForFree).toBe(true);
    expect(schema).not.toHaveProperty("license");
    expect(schema.copyrightNotice).toContain("No reuse license has been granted");
    expect(distributions).toEqual([
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
    ]);
    expect(parts).toHaveLength(5);
    expect(parts.every((part) => part.name && part.description && part.url && part.sameAs)).toBe(true);
  });

  it("sets canonical route metadata and links the page from the season hub", () => {
    expect(metadata.alternates).toEqual({ canonical: SEASON_DATASET_PATH });
    expect(metadata.description).toBe(SEASON_DATASET_DESCRIPTION);

    const seasonSource = fs.readFileSync(
      path.join(process.cwd(), "app", "season-2026-27", "page.tsx"),
      "utf8",
    );
    expect(seasonSource).toContain(`href="${SEASON_DATASET_PATH}"`);
  });
});
