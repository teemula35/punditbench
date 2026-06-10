import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { GITHUB_URL, SITE_NAME, SITE_URL, TAGLINE } from "@/lib/site";
import { Analytics, AnalyticsSettingsLink } from "./analytics";
import { Wordmark } from "./ui";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — 33 LLMs predict the 2026 World Cup`,
    template: `%s · ${SITE_NAME}`,
  },
  description: TAGLINE,
  openGraph: {
    title: `${SITE_NAME} — 33 LLMs predict the 2026 World Cup`,
    description: TAGLINE,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
};

const NAV = [
  { href: "/", label: "Leaderboard" },
  { href: "/matches/", label: "Matches" },
  { href: "/groups/", label: "Groups" },
  { href: "/models/", label: "Models" },
  { href: "/methodology/", label: "Methodology" },
  { href: "/about/", label: "About" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-300 antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-zinc-800/80 bg-zinc-950/95">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-4 sm:px-6">
              <Link href="/" className="shrink-0">
                <Wordmark />
              </Link>
              <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-zinc-400 transition-colors hover:text-emerald-400"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">{children}</main>

          <footer className="border-t border-zinc-800/80">
            <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 text-xs leading-relaxed text-zinc-500 sm:px-6">
              <p>
                Statistics &amp; entertainment only — not betting advice. · All predictions are
                AI-generated content. · {SITE_NAME} is an independent project, not affiliated with
                FIFA or any federation; tournament and team names are used editorially.
              </p>
              <p className="flex flex-wrap gap-x-4 gap-y-1">
                <a href={GITHUB_URL} className="hover:text-emerald-400">
                  GitHub
                </a>
                <Link href="/methodology/" className="hover:text-emerald-400">
                  Methodology
                </Link>
                <Link href="/changelog/" className="hover:text-emerald-400">
                  Changelog
                </Link>
                <Link href="/about/" className="hover:text-emerald-400">
                  About
                </Link>
                <AnalyticsSettingsLink />
              </p>
            </div>
          </footer>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
