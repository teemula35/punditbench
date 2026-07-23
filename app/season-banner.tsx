import Link from "next/link";

/**
 * Site-wide announcement strip for the 2026-27 league expansion. Shipped during
 * the World Cup's final week to convert peak traffic into return visitors; now
 * that the league pages exist it points at them instead of the teaser, and the
 * home page carries the fuller pitch (see the league bridge in app/page.tsx),
 * so this stays a one-line pointer rather than repeating it.
 */
export function SeasonBanner() {
  return (
    <div className="border-b border-emerald-400/20 bg-emerald-400/5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-[13px] sm:px-6">
        <span className="font-semibold uppercase tracking-widest text-emerald-400">
          Season 2026-27
        </span>
        <span className="text-zinc-300">
          Premier League, La Liga &amp; the top European leagues — every matchday, picks locked
          before kickoff, from <span className="tabular-nums">Aug 16</span>.
        </span>
        <Link href="/leagues/" className="text-emerald-400 hover:underline">
          Explore the leagues →
        </Link>
      </div>
    </div>
  );
}
