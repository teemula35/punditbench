/**
 * "Get notified" signup — a plain HTML form posting to Buttondown's embed
 * endpoint (no client JS, works in the static export). Ships disabled until
 * BUTTONDOWN_USERNAME is set in lib/site.ts; the fallback still gives people
 * a way to follow the project.
 */
import React from "react";
import { BUTTONDOWN_USERNAME, GITHUB_URL } from "../lib/site";

const MATCHDAY_NOTES_TAG = "matchday-notes";

export function NotifyForm() {
  if (!BUTTONDOWN_USERNAME) {
    return (
      <p className="text-sm text-zinc-400">
        Want the short matchday notes?{" "}
        <a href={GITHUB_URL} className="text-emerald-400 hover:underline">
          Watch the repository on GitHub
        </a>{" "}
        — every lock is a public commit and tag — or check back here after each round.
      </p>
    );
  }
  return (
    <form
      action={`https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USERNAME}`}
      method="post"
      className="flex max-w-md flex-wrap gap-2"
    >
      <input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        aria-label="Email address"
        className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400 focus:outline-none"
      />
      <input type="hidden" name="tag" value={MATCHDAY_NOTES_TAG} />
      <button
        type="submit"
        className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20"
      >
        Get matchday notes
      </button>
      <p className="basis-full text-xs text-zinc-600">
        A short note per matchday round. Lock alerts use the separate interest list. No spam,
        unsubscribe anytime.
      </p>
    </form>
  );
}
