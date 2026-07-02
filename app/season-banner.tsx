import Link from "next/link";

/**
 * Site-wide announcement strip for the 2026-27 league expansion. Ships during
 * the World Cup's final week to convert peak traffic into return visitors;
 * removed (or repointed at /leagues/) when the league pages go live.
 */
export function SeasonBanner() {
  return (
    <div className="border-b border-emerald-400/20 bg-emerald-400/5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-[13px] sm:px-6">
        <span className="font-semibold uppercase tracking-widest text-emerald-400">
          Season 2026-27
        </span>
        <span className="text-zinc-300">
          The benchmark continues after the final: Premier League, La Liga &amp; the top European
          leagues — every matchday, picks locked before kickoff, from{" "}
          <span className="tabular-nums">Aug 16</span>.
        </span>
        <Link href="/season-2026-27/" className="text-emerald-400 hover:underline">
          What&apos;s coming →
        </Link>
      </div>
    </div>
  );
}
