import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { PageTitle } from "../ui";

export const metadata: Metadata = {
  title: "You're on the list — thanks!",
  description: `You're confirmed for the ${SITE_NAME} 2026-27 league launch.`,
  robots: { index: false },
};

/**
 * Buttondown "After confirming" redirect target
 * (subscription_confirmation_redirect_url): shown once the subscriber clicks
 * the confirmation link in their email — the done/celebratory state. The
 * pre-confirmation nudge lives on /subscribed/.
 */
export default function ConfirmedPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <PageTitle
        kicker="Season 2026-27"
        title="You're on the list"
        sub="Confirmed — thanks for subscribing."
      />

      <section className="space-y-4 text-sm leading-relaxed text-zinc-300">
        <p>
          That&apos;s it. You&apos;ll get one email the moment the first league picks lock in
          August — every model&apos;s matchday predictions, pre-registered before kickoff, exactly
          like the World Cup you just watched {SITE_NAME} grade.
        </p>
        <p className="text-zinc-400">No spam, unsubscribe anytime.</p>
      </section>

      <section className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/"
          className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 font-medium text-emerald-300 hover:bg-emerald-400/20"
        >
          Back to the leaderboard
        </Link>
        <Link
          href="/season-2026-27/"
          className="rounded-md border border-zinc-700 px-4 py-2 font-medium text-zinc-200 hover:border-zinc-500"
        >
          The launch calendar
        </Link>
      </section>
    </div>
  );
}
