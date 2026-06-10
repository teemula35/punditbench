import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

/**
 * Render a repository markdown file to HTML at build time.
 * Relative repo links like `data/roster.json` are rewritten to absolute
 * site paths (the build copies data/ into the export at /data/).
 */
export function renderMarkdownFile(filename: string): string {
  const raw = fs.readFileSync(path.join(process.cwd(), filename), "utf-8");
  const html = marked.parse(raw, { async: false });
  return html.replace(/href="(?:\.\/)?data\//g, 'href="/data/');
}
