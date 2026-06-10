import type { Metadata } from "next";
import Link from "next/link";
import { loadRoster } from "@/lib/data";
import { modelSlug } from "@/lib/prompt";
import { GA_MEASUREMENT_ID, GITHUB_URL, SITE_NAME } from "@/lib/site";
import { PageTitle } from "../ui";

export const metadata: Metadata = {
  title: "About",
  description: "What PunditBench is, how it works, honest caveats, and the legal fine print.",
};

const A_CLS =
  "text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-400";

export default function AboutPage() {
  const exampleSlug = modelSlug(loadRoster()[0]?.id ?? "openai/gpt-5.5");
  return (
    <div className="max-w-3xl space-y-10">
      <PageTitle kicker="About" title={`What is ${SITE_NAME}?`} />

      <section className="space-y-4 text-sm leading-relaxed text-zinc-300">
        <p>
          {SITE_NAME} is a public experiment: 33 large language models — flagships, mid-tiers and
          small models from 17 vendors — each predicted the <em>entire</em> 2026 World Cup before
          the opening kickoff. The models get no live data, no odds, no squad news; just their
          training knowledge and identical prompts. Reality then grades every claim, match by
          match and round by round.
        </p>
        <p>
          It works as a self-consistent simulation. Every model first predicts all 72 group
          matches in one prompt. From its own scorelines we compute its own group tables and best
          third-placed teams (FIFA tiebreakers, official Annexe C slotting), which yields the
          model&apos;s own Round of 32 — and it then predicts each knockout round of its own
          simulated tournament, through to its own champion. Nothing anywhere depends on a real
          result; the complete set, raw API traffic included, is locked and SHA-256
          pre-registered in the public repository before kickoff, so nothing can be quietly
          edited after the fact.
        </p>
        <p>
          Scoring is identical for everyone. Group matches: 3 points for the exact score, 2 for
          the right goal difference, 1 for the right outcome. The bracket is scored against the
          real tournament as it unfolds: points for every real team a model had reaching each
          stage (champion 13), a bonus for every simulated pairing that actually occurs, and
          matched pairings&apos; scorelines scored like normal matches. The complete rules,
          integrity checks and caveats are in the{" "}
          <Link href="/methodology/" className={A_CLS}>
            methodology
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-100">Honest caveats</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
          <li>
            One run at temperature 0 samples a single trajectory, not a model&apos;s full
            predictive distribution.
          </li>
          <li>
            Football is high-variance and bracket scoring is top-heavy by design — a lucky
            champion call moves the table. Treat small leaderboard gaps as noise.
          </li>
          <li>
            Knowledge cutoffs differ between models; some predate squad announcements or even
            qualification. That asymmetry is part of what is being measured, not corrected for.
          </li>
          <li>This is a benchmark of language models, not a forecasting product.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-100">Legal</h2>
        <div className="space-y-3 text-sm leading-relaxed text-zinc-400">
          <p>
            <span className="font-medium text-zinc-200">Not betting advice.</span> Everything on
            this site is statistics and entertainment only. Do not use it to gamble.
          </p>
          <p>
            <span className="font-medium text-zinc-200">AI-generated content.</span> All
            predictions shown on this site are AI-generated content, produced by the listed
            language models.
          </p>
          <p>
            <span className="font-medium text-zinc-200">Trademarks.</span> {SITE_NAME} is an
            independent project, not affiliated with, endorsed by, or connected to FIFA or any
            football federation. Tournament and team names are used editorially to describe real
            sporting events.
          </p>
          {/* The privacy text mirrors reality: while GA_MEASUREMENT_ID is empty
              there is no banner and no analytics, so the old claim stays true. */}
          {GA_MEASUREMENT_ID ? (
            <p id="privacy">
              <span className="font-medium text-zinc-200">Privacy.</span> By default this site
              sets no cookies. If you accept in the consent banner, Google Analytics 4 counts
              visits — pseudonymous usage statistics with anonymized IP addresses; no ads, no
              cross-site tracking. Your choice is stored only on your device, and you can change
              it at any time via &ldquo;Analytics settings&rdquo; in the footer. Analytics data
              is processed by Google — see{" "}
              <a href="https://policies.google.com/privacy" className={A_CLS}>
                Google&apos;s privacy policy
              </a>
              .
            </p>
          ) : (
            <p id="privacy">
              <span className="font-medium text-zinc-200">Privacy.</span> This site sets no
              cookies and runs no tracking. The site is fully static.
            </p>
          )}
          <p>
            <span className="font-medium text-zinc-200">Imprint.</span> Publisher: to be
            announced. Contact:{" "}
            <a href={`${GITHUB_URL}/issues`} className={A_CLS}>
              GitHub issues
            </a>
            .
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-100">Data</h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          Everything is published as plain JSON, copied into this site at build time and versioned
          in the{" "}
          <a href={GITHUB_URL} className={A_CLS}>
            public repository
          </a>
          :
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-400">
          <li>
            <a href="/data/roster.json" className={`${A_CLS} font-mono text-xs`}>
              /data/roster.json
            </a>{" "}
            — the frozen 33-model roster
          </li>
          <li>
            <a href="/data/teams.json" className={`${A_CLS} font-mono text-xs`}>
              /data/teams.json
            </a>{" "}
            — the 48 qualified teams
          </li>
          <li>
            <a href="/data/fixtures/group.json" className={`${A_CLS} font-mono text-xs`}>
              /data/fixtures/&lt;stage&gt;.json
            </a>{" "}
            — fixtures per stage
          </li>
          <li>
            <a href="/data/results.json" className={`${A_CLS} font-mono text-xs`}>
              /data/results.json
            </a>{" "}
            — real results as they are entered
          </li>
          <li>
            <a href={`/data/predictions/group/${exampleSlug}.json`} className={`${A_CLS} font-mono text-xs`}>
              /data/predictions/&lt;stage&gt;/&lt;model&gt;.json
            </a>{" "}
            — every model&apos;s predictions per stage
          </li>
        </ul>
        <p className="text-sm text-zinc-500">
          Points are never stored — they are recomputed from predictions and results on every
          build, so anything on this site can be re-derived from the files above.
        </p>
      </section>
    </div>
  );
}
