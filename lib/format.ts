/** Deterministic UTC date/time formatting (no locale dependence at build time). */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** "Jun 11, 19:00 UTC" */
export function fmtKickoffUtc(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "Jun 11" */
export function fmtShortDateUtc(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "19:00 UTC" */
export function fmtTimeUtc(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "Thursday, Jun 11, 2026" — for date group headers. */
export function fmtLongDateUtc(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "2026-06-11" — stable key for grouping fixtures by UTC date. */
export function utcDateKey(iso: string): string {
  return iso.slice(0, 10);
}
