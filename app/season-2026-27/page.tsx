import type { Metadata } from "next";
import Link from "next/link";
import { NotifyForm } from "../notify";
import { PageTitle } from "../ui";

export const metadata: Metadata = {
  title: "Season 2026-27 — the benchmark continues",
  description:
    "After the World Cup, PunditBench moves to the top European leagues: every matchday, all models, picks pre-registered before kickoff — plus locked pre-season table predictions.",
};

/**
 * Self-contained announcement page (no league-data imports — it ships to the
 * public repo ahead of the league pages themselves). Dates below were verified
 * against the fixture feeds on 2026-07-02.
 */
const LAUNCHES = [
  { league: "La Liga", when: "Matchday 1 — August 16" },
  { league: "Premier League", when: "Matchday 1 — August 21" },
  { league: "Serie A & Ligue 1", when: "Opening weekend — August 22" },
  { league: "Bundesliga", when: "When the 2026-27 fixtures are published" },
  { league: "Champions League", when: "From the league phase in September" },
];

export default function SeasonAnnouncementPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <PageTitle
        kicker="Season 2026-27"
        title="The benchmark continues"
        sub="The World Cup ends July 19. The models keep predicting."
      />

      <section className="space-y-4 text-sm leading-relaxed text-zinc-300">
        <p>
          PunditBench spent a summer grading how well language models predict real football —
          every match of the 2026 World Cup, locked and pre-registered before the opening
          kickoff. That tournament stays on this site permanently, exactly as it happened:
          the leaderboard, all match pages, the hashes and the raw logs.
        </p>
        <p>
          From mid-August, the same benchmark moves to the biggest European leagues. Two
          tracks per league, both pre-registered like everything here:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-zinc-400">
          <li>
            <span className="font-medium text-zinc-200">Weekly matchday picks.</span> Before
            every round, all models predict every match — shown the current league table and
            each team&apos;s recent form, so the benchmark measures football judgement rather
            than whose training data is freshest. Picks lock ~36 hours before each round&apos;s
            first kickoff, hashed and tagged in the public repository.
          </li>
          <li>
            <span className="font-medium text-zinc-200">Pre-season table predictions.</span>{" "}
            Before each league&apos;s opener, every model commits a full final-table
            prediction — graded live all season as &quot;if it ended today&quot;.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">Launch calendar</h2>
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-800/70">
              {LAUNCHES.map((l) => (
                <tr key={l.league}>
                  <td className="px-4 py-2.5 font-medium text-zinc-100">{l.league}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{l.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          Dates from the official fixture feeds; TV scheduling can still move individual
          kickoffs.
        </p>
      </section>

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
