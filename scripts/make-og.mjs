/**
 * Rasterizes scripts/og-card.svg to public/og.png (the 1200x630 Open Graph
 * preview image referenced from app/layout.tsx). Build-time tooling only —
 * sharp is a devDependency and nothing at runtime depends on it.
 *
 *   node scripts/make-og.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(path.join(here, "og-card.svg"));
const out = path.join(here, "..", "public", "og.png");

// Render the SVG at 2x density, then downsample for crisper text edges.
await sharp(svg, { density: 144 })
  .resize(1200, 630)
  .png({ compressionLevel: 9 })
  .toFile(out);

const meta = await sharp(out).metadata();
if (meta.width !== 1200 || meta.height !== 630) {
  throw new Error(`og.png is ${meta.width}x${meta.height}, expected 1200x630`);
}
console.log(`make-og: wrote public/og.png (${meta.width}x${meta.height})`);
