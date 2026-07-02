/**
 * C11: copy public data files into public/data/ at build time so the site
 * exports them for download (predictions, results, fixtures, roster).
 */
import fs from "node:fs";
import path from "node:path";

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
  "competitions.json",
  "competitions",
];
for (const item of include) {
  const src = path.join(ROOT, "data", item);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(dest, item), { recursive: true });
}
console.log("prepare-export: copied data/ -> public/data/");
