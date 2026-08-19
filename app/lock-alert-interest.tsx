import React from "react";
import { BUTTONDOWN_USERNAME } from "../lib/site";

const LOCK_ALERT_TAG = "prediction-lock-alerts";

export function LockAlertInterest() {
  if (!BUTTONDOWN_USERNAME) {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Lock alerts · Interest list
        </p>
        <h2 className="mt-2 text-lg font-semibold text-zinc-100">
          A short email after a matchday locks?
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          The separate interest list is not open yet. Alerts are not live yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Lock alerts · Interest list
      </p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-100">
        A short email after a matchday locks?
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Interested in a short link after a league matchday&apos;s predictions are fully locked and
        public? This is separate from the matchday notes. Alerts are not live yet; join the
        interest list and we&apos;ll email once if a small pilot opens.
      </p>
      <form
        action={`https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USERNAME}`}
        method="post"
        className="mt-4 flex max-w-md flex-wrap gap-2"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          aria-label="Email address for lock-alert interest list"
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400 focus:outline-none"
        />
        <input type="hidden" name="tag" value={LOCK_ALERT_TAG} />
        <button
          type="submit"
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-emerald-400/50 hover:text-emerald-300"
        >
          Join the interest list
        </button>
        <p className="basis-full text-xs text-zinc-600">
          Double opt-in. One email if a pilot opens. Unsubscribe anytime.
        </p>
      </form>
    </section>
  );
}
