import type { Metadata } from "next";
import Link from "next/link";
import {
  loadSeasonDatasetSummary,
  SEASON_DATASET_DESCRIPTION,
  SEASON_DATASET_DOWNLOADS,
  SEASON_DATASET_NAME,
  SEASON_DATASET_PATH,
  SEASON_DATASET_SOURCE_URL,
  seasonDatasetJsonLd,
} from "@/lib/season-dataset";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { PageTitle } from "../../ui";

export const metadata: Metadata = {
  title: "2026–27 LLM season-table forecast dataset",
  description: SEASON_DATASET_DESCRIPTION,
  alternates: { canonical: SEASON_DATASET_PATH },
  openGraph: {
    title: `${SEASON_DATASET_NAME} | ${SITE_NAME}`,
    description: SEASON_DATASET_DESCRIPTION,
    url: `${SITE_URL}${SEASON_DATASET_PATH}`,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: SEASON_DATASET_NAME,
    description: SEASON_DATASET_DESCRIPTION,
  },
};

export default function SeasonDatasetPage() {
  const summary = loadSeasonDatasetSummary();
  const jsonLd = seasonDatasetJsonLd(summary);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="max-w-3xl space-y-10">
        <PageTitle
          kicker="Public dataset"
          title="2026–27 pre-registered season tables"
          sub={`${summary.forecastCount} complete final-table forecasts from ${summary.distinctModelCount} distinct language models across five European leagues, with 40–42 forecasts per league and every table locked before the relevant opening kickoff.`}
        />

        <section className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-zinc-100">Download the frozen snapshot</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            The same {summary.forecastCount}-row snapshot is mirrored on Hugging Face and Kaggle.
            JSONL preserves each predicted table as an array; the Kaggle bundle also includes a CSV
            export, source manifest and SHA-256 checksums.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={SEASON_DATASET_DOWNLOADS.jsonl}
              rel="noopener noreferrer"
              target="_blank"
              className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-300"
            >
              Download JSONL ↗
            </a>
            <a
              href={SEASON_DATASET_DOWNLOADS.kaggleArchive}
              rel="noopener noreferrer"
              target="_blank"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition-colors hover:border-emerald-400/60"
            >
              Download Kaggle ZIP ↗
            </a>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">What is inside</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Each row is one model&apos;s complete predicted finishing order for one league, together
              with its model identifier, prompt version, request timestamps, lock digest and exact
              pre-registration source.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {summary.leagues.map((league) => (
              <li key={league.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <Link
                  href={`/leagues/${league.id}/`}
                  className="font-semibold text-zinc-100 underline decoration-zinc-500 underline-offset-2 hover:text-emerald-400"
                >
                  {league.shortName}
                </Link>
                <p className="mt-1 text-sm tabular-nums text-zinc-400">
                  {league.forecastCount} complete tables
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section id="integrity" className="space-y-3 scroll-mt-6">
          <h2 className="text-lg font-semibold text-zinc-100">Locked before kickoff</h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Every included forecast was committed publicly, hashed and tagged before that league&apos;s
            opening kickoff. No table was added later to fill a gap. The same frozen field remains
            visible on the live league pages throughout the season.
          </p>
          <p className="text-sm text-zinc-400">
            Read the {" "}
            <Link
              href="/methodology/"
              className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-400"
            >
              methodology
            </Link>{" "}
            or inspect the {" "}
            <a
              href={SEASON_DATASET_SOURCE_URL}
              rel="noopener noreferrer"
              target="_blank"
              className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-400"
            >
              source-of-record competition tree ↗
            </a>
            .
          </p>
        </section>

        <section
          id="license"
          aria-labelledby="license-heading"
          className="space-y-2 rounded-lg border border-zinc-800 px-4 py-3 text-xs leading-relaxed text-zinc-400"
        >
          <h2 id="license-heading" className="font-semibold text-zinc-200">
            Reuse and limits
          </h2>
          <p>
            No reuse license has been granted for this snapshot. Public availability does not itself
            grant permission to reproduce, modify or redistribute the data. Contact the repository
            owner before reuse beyond inspection and citation.
          </p>
          <p>
            Every forecast is AI-generated and may be wrong. For adults (18+). Informational only,
            not betting advice.
          </p>
        </section>
      </div>
    </>
  );
}
