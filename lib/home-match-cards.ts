import { activeCompetitions } from "./data";
import { fmtKickoffUtc } from "./format";
import { leagueMatchInfo, loadLeagueData } from "./league-aggregate";
import { isMatchdayKey, matchdayNumber } from "./types";

export interface HomeMatchCard {
  /** Competition-qualified identity; league match numbers repeat. */
  id: string;
  /** Canonical match route for this competition. */
  href: string;
  kickoff_utc: string;
  stageLabel: string;
  homeLabel: string;
  awayLabel: string;
  kickoffLabel: string;
  scoreLabel?: string;
  consensusLine?: string;
  splitLine?: string;
}

/** Keep past cards bounded while retaining every future fixture from a locked round. */
const RECENT_CARD_WINDOW_MS = 72 * 60 * 60 * 1000;
/** Hard ceiling for match-card objects serialized into the homepage client payload. */
export const MAX_SERIALIZED_HOME_MATCH_CARDS = 64;

function chronological(a: HomeMatchCard, b: HomeMatchCard): number {
  return a.kickoff_utc.localeCompare(b.kickoff_utc) || a.id.localeCompare(b.id);
}

/**
 * Apply the payload budget after lock filtering. Future fixtures take priority
 * over recent cards so completed results cannot evict links that still need to
 * appear on a later date; the returned artifact remains chronological.
 */
export function selectSerializedHomeMatchCards(
  cards: HomeMatchCard[],
  referenceTime: Date,
): HomeMatchCard[] {
  const referenceMs = referenceTime.getTime();
  const byPayloadPriority = cards
    .filter((card) => Number.isFinite(Date.parse(card.kickoff_utc)))
    .sort((a, b) => {
      const aKickoff = Date.parse(a.kickoff_utc);
      const bKickoff = Date.parse(b.kickoff_utc);
      const aIsFuture = aKickoff >= referenceMs;
      const bIsFuture = bKickoff >= referenceMs;
      if (aIsFuture !== bIsFuture) return aIsFuture ? -1 : 1;
      return aIsFuture
        ? aKickoff - bKickoff || a.id.localeCompare(b.id)
        : bKickoff - aKickoff || a.id.localeCompare(b.id);
    });

  return byPayloadPriority.slice(0, MAX_SERIALIZED_HOME_MATCH_CARDS).sort(chronological);
}

/** Read-only homepage cards derived only from already locked league prediction rounds. */
export function loadHomepageLeagueCards(referenceTime = new Date()): HomeMatchCard[] {
  const referenceMs = referenceTime.getTime();
  const cards: HomeMatchCard[] = [];

  for (const comp of activeCompetitions()) {
    const data = loadLeagueData(comp.id);
    for (const fixture of data.fixtures.values()) {
      const kickoffMs = Date.parse(fixture.kickoff_utc);
      if (!Number.isFinite(kickoffMs) || referenceMs - kickoffMs > RECENT_CARD_WINDOW_MS) continue;
      if (!isMatchdayKey(fixture.stage)) continue;

      const info = leagueMatchInfo(data, fixture);
      if (info.state !== "picks" || !info.consensus || !info.split) continue;

      const result = data.results.get(fixture.match);
      const played =
        result?.status === "final" &&
        result.home_goals !== undefined &&
        result.away_goals !== undefined;
      const { consensus, split } = info;
      const strongest =
        split.home >= split.away && split.home >= split.draw
          ? `${split.home}/${split.outOf} back ${fixture.home}`
          : split.away >= split.draw
            ? `${split.away}/${split.outOf} back ${fixture.away}`
            : `${split.draw}/${split.outOf} call a draw`;

      cards.push({
        id: `${comp.id}:${fixture.match}`,
        href: `/leagues/${comp.id}/matches/${fixture.match}/`,
        kickoff_utc: fixture.kickoff_utc,
        stageLabel: `${comp.short_name} · Matchday ${matchdayNumber(fixture.stage)}`,
        homeLabel: fixture.home,
        awayLabel: fixture.away,
        kickoffLabel: fmtKickoffUtc(fixture.kickoff_utc),
        scoreLabel: played ? `${result.home_goals}–${result.away_goals}` : undefined,
        consensusLine: `Consensus ${consensus.home}–${consensus.away} · ${consensus.count} of ${consensus.outOf}`,
        splitLine: strongest,
      });
    }
  }

  return selectSerializedHomeMatchCards(cards, referenceTime);
}
