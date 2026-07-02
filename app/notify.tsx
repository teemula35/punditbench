/**
 * "Get notified" signup — a plain HTML form posting to Buttondown's embed
 * endpoint (no client JS, works in the static export). Ships disabled until
 * BUTTONDOWN_USERNAME is set in lib/site.ts; the fallback still gives people
 * a way to follow the project.
 */
import { BUTTONDOWN_USERNAME, GITHUB_URL } from "@/lib/site";

export function NotifyForm() {
  if (!BUTTONDOWN_USERNAME) {
    return (
      <p className="text-sm text-zinc-400">
        Want to know the moment the first picks lock?{" "}
        <a href={GITHUB_URL} className="text-emerald-400 hover:underline">
          Watch the repository on GitHub
        </a>{" "}
        — every lock is a public commit and tag — or check back here at launch.
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
      <button
        type="submit"
        className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20"
      >
        Notify me
      </button>
      <p className="basis-full text-xs text-zinc-600">
        Season launch + the World Cup final report. No spam, unsubscribe anytime.
      </p>
    </form>
  );
}
