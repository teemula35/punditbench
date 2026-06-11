import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";

// Raw HTML embedded in markdown is dropped (rendered as nothing) — our docs
// are pure markdown, and this removes the only injection path through
// dangerouslySetInnerHTML should the rendered files ever gain external
// contributors (defense in depth).
const renderer = new Marked({
  renderer: {
    html: () => "",
  },
});

/**
 * Render a repository markdown file to HTML at build time.
 * Relative repo links like `data/roster.json` are rewritten to absolute
 * site paths (the build copies data/ into the export at /data/).
 */
export function renderMarkdownFile(filename: string): string {
  const raw = fs.readFileSync(path.join(process.cwd(), filename), "utf-8");
  const html = renderer.parse(raw, { async: false }) as string;
  return html.replace(/href="(?:\.\/)?data\//g, 'href="/data/');
}
