import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { PageTitle } from "../ui";

export const metadata: Metadata = {
  title: "Almost there — confirm your email",
  description: `Confirm your email to join the ${SITE_NAME} 2026-27 league launch list.`,
  robots: { index: false },
};

/**
 * Buttondown "After subscribing" redirect target (subscription_redirect_url):
 * shown right after the form is submitted, BEFORE the subscriber confirms. Its
 * one job is to push them to the confirmation email. The confirmed/done state
 * lives on /confirmed/ (subscription_confirmation_redirect_url).
 */
export default function SubscribedPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <PageTitle
        kicker="Season 2026-27"
        title="Almost there"
        sub="One quick step to lock in your spot."
      />

      <section className="space-y-4 text-sm leading-relaxed text-zinc-300">
        <p>
          Check your inbox — we just sent a confirmation link. Click it and you&apos;re on the list
          for the {SITE_NAME} league launch.
        </p>
        <p className="text-zinc-400">
          Nothing after a minute or two? Check your spam or promotions folder — or just submit the
          form again.
        </p>
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
