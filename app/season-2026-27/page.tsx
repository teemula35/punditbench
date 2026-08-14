import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { NotifyForm } from "../notify";
import { PageTitle } from "../ui";
import { SeasonLaunchCalendar } from "./launch-calendar";

const OG_TITLE = `${SITE_NAME} — five European leagues in 2026-27`;
const OG_DESCRIPTION =
  "PunditBench now covers the Premier League, La Liga, Serie A, Ligue 1 and Bundesliga: every matchday, the eligible model field, picks locked before kickoff.";

// The layout's openGraph/twitter blocks are World Cup flavoured, so league
// links unfurled as tournament news. These override both (og:* and twitter:*
// are set separately — X prefers the latter); the card itself comes from the
// sibling opengraph-image.tsx, which wins over any images listed here.
export const metadata: Metadata = {
  title: "Season 2026-27 — five leagues live",
  description:
    "PunditBench covers five European leagues: every matchday, the eligible model field, picks pre-registered before kickoff — plus locked pre-season table predictions.",
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: `${SITE_URL}/season-2026-27/`,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
};

export default function SeasonAnnouncementPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <PageTitle
        kicker="Season 2026-27"
        title="Five leagues are live"
        sub="The World Cup archive stays. The benchmark now runs every week."
      />

      <section className="space-y-4 text-sm leading-relaxed text-zinc-300">
        <p>
          PunditBench spent a summer grading how well language models predict real football —
          every match of the 2026 World Cup, locked and pre-registered before the opening
          kickoff. That tournament stays on this site permanently, exactly as it happened:
          the leaderboard, all match pages, the hashes and the raw logs.
        </p>
        <p>
          The same benchmark now covers five European leagues. Two tracks per league, both
          pre-registered like everything here:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-zinc-400">
          <li>
            <span className="font-medium text-zinc-200">Weekly matchday picks.</span> Before
            every round, every eligible model predicts every match — shown the current league table and
            each team&apos;s recent form, so the benchmark measures football judgement rather
            than whose training data is freshest. Picks lock ~36 hours before each round&apos;s
            first kickoff, hashed and tagged in the public repository.
          </li>
          <li>
            <span className="font-medium text-zinc-200">Pre-season table predictions.</span>{" "}
            Before each league&apos;s opener, the launch roster is asked to commit a full final-table
            prediction — graded live all season as &quot;if it ended today&quot;.
          </li>
        </ul>
      </section>

      <SeasonLaunchCalendar />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-100">Get notified</h2>
        <NotifyForm />
      </section>

      <section className="space-y-2 text-xs leading-relaxed text-zinc-500">
        <p>
          Same rules as always: identical prompts for every model, strict validation, public
          raw logs, and nothing counts unless it verifiably predates kickoff — see the{" "}
          <Link href="/methodology/" className="text-emerald-400 hover:underline">
            methodology
          </Link>
          . Predictions are statistics &amp; entertainment, not betting advice.
        </p>
      </section>
    </div>
  );
}
