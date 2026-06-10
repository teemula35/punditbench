import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">404</p>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
        Off target — page not found.
      </h1>
      <p className="max-w-md text-sm text-zinc-400">
        The page you are looking for does not exist (or the fixture has not been scheduled yet).
      </p>
      <Link
        href="/"
        className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-400/20"
      >
        Back to the leaderboard
      </Link>
    </div>
  );
}
