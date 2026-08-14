import type { LeagueMatchInfo } from "./league-aggregate";

/** State-accurate lead text for league match metadata descriptions. */
export function leagueMatchMetadataPickSummary(
  info: LeagueMatchInfo,
  eligibleCount: number,
): string {
  if (info.state === "excluded") return "No pre-registered LLM picks";
  if (info.state === "pending") return `${eligibleCount} LLMs are eligible to predict`;
  const storedCount = info.rows.filter((row) => row.prediction !== undefined).length;
  return `${storedCount} pre-registered LLM ${storedCount === 1 ? "pick" : "picks"}`;
}
