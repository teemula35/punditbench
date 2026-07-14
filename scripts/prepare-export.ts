/**
 * C11: copy public data files into public/data/ at build time so the site
 * exports them for download (predictions, results, fixtures, roster).
 * Also generates public/feed.xml (RSS) from CHANGELOG.md.
 */
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { SITE_NAME, SITE_URL } from "../lib/site";

const ROOT = process.cwd();
const dest = path.join(ROOT, "public", "data");
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

const include = [
  "teams.json",
  "roster.json",
  "results.json",
  "fixtures",
  "predictions",
  "predictions-live",
  "hashes",
];
for (const item of include) {
  const src = path.join(ROOT, "data", item);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(dest, item), { recursive: true });
}
console.log("prepare-export: copied data/ -> public/data/");

// RSS feed from the changelog — scoring/data/methodology updates only (no
// league content). Static file served at /feed.xml; the discovery <link> is
// declared in app/layout.tsx metadata.
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFeed(): void {
  const changelog = path.join(ROOT, "CHANGELOG.md");
  if (!fs.existsSync(changelog)) return;
  const md = fs.readFileSync(changelog, "utf-8");
  const sections = md.split(/\n## /).slice(1); // drop the "# title" + intro
  const items = sections.map((chunk) => {
    const nl = chunk.indexOf("\n");
    const heading = (nl === -1 ? chunk : chunk.slice(0, nl)).trim();
    const body = (nl === -1 ? "" : chunk.slice(nl + 1)).trim();
    const dateStr = heading.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    const date = dateStr ? new Date(`${dateStr}T12:00:00Z`) : undefined;
    const html = marked.parse(body, { async: false }) as string;
    const guid = `${SITE_URL}/changelog/#${dateStr ?? encodeURIComponent(heading)}`;
    return { heading, html, date, guid };
  });

  const itemXml = items
    .map(
      (it) => `    <item>
      <title>${xmlEscape(`${SITE_NAME} — ${it.heading}`)}</title>
      <link>${it.guid}</link>
      <guid isPermaLink="false">${it.guid}</guid>${
        it.date ? `\n      <pubDate>${it.date.toUTCString()}</pubDate>` : ""
      }
      <description><![CDATA[${it.html.replace(/]]>/g, "]]&gt;")}]]></description>
    </item>`,
    )
    .join("\n");

  const lastBuild = items.find((i) => i.date)?.date?.toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(SITE_NAME)} — changelog</title>
    <link>${SITE_URL}/changelog/</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Scoring, data and methodology updates for ${xmlEscape(SITE_NAME)}, the LLM football-prediction benchmark.</description>
    <language>en</language>${lastBuild ? `\n    <lastBuildDate>${lastBuild}</lastBuildDate>` : ""}
${itemXml}
  </channel>
</rss>
`;
  fs.writeFileSync(path.join(ROOT, "public", "feed.xml"), xml, "utf-8");
  console.log(`prepare-export: wrote public/feed.xml (${items.length} items)`);
}
buildFeed();
