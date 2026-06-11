/**
 * Page-view report from the cookieless counter (Firestore /counters/*).
 *
 *   npm run views
 *
 * Counts are anonymous aggregates written by app/counter.tsx: one +1 per page
 * view to `total`, `d-YYYYMMDD` (UTC day) and `p-<path>`. Page views, not
 * unique visitors — uniques would need identifiers, which the counter
 * deliberately doesn't have.
 */
import { COUNTER_API_KEY, COUNTER_PROJECT } from "../lib/site";

const BASE = `https://firestore.googleapis.com/v1/projects/${COUNTER_PROJECT}/databases/(default)/documents`;

interface FsDoc {
  name: string;
  fields?: { count?: { integerValue?: string } };
}

async function listCounters(): Promise<{ id: string; count: number }[]> {
  const out: { id: string; count: number }[] = [];
  let pageToken = "";
  do {
    const url = `${BASE}/counters?key=${COUNTER_API_KEY}&pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Firestore list failed: HTTP ${res.status}`);
    const json = (await res.json()) as { documents?: FsDoc[]; nextPageToken?: string };
    for (const doc of json.documents ?? []) {
      const id = doc.name.split("/").pop()!;
      const count = Number(doc.fields?.count?.integerValue ?? 0);
      out.push({ id, count });
    }
    pageToken = json.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

const counters = await listCounters();
const total = counters.find((c) => c.id === "total")?.count ?? 0;
const days = counters
  .filter((c) => c.id.startsWith("d-"))
  .sort((a, b) => b.id.localeCompare(a.id));
const pages = counters
  .filter((c) => c.id.startsWith("p-"))
  .sort((a, b) => b.count - a.count);

console.log(`PunditBench page views (cookieless counter)\n`);
console.log(`TOTAL: ${total.toLocaleString("en")}\n`);
console.log(`Last days (UTC):`);
for (const d of days.slice(0, 14)) {
  const date = `${d.id.slice(2, 6)}-${d.id.slice(6, 8)}-${d.id.slice(8, 10)}`;
  console.log(`  ${date}  ${String(d.count).padStart(6)}`);
}
console.log(`\nTop pages:`);
for (const p of pages.slice(0, 15)) {
  const path = "/" + p.id.slice(2).replace(/~/g, "/");
  console.log(`  ${String(p.count).padStart(6)}  ${path === "/home" ? "/" : path}`);
}
if (days.length === 0 && pages.length === 0) {
  console.log("\n(no per-day/per-page counters yet — they appear with the first real visits)");
}
