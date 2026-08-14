// Earliest configured Matchday 1 kickoff per league, verified against the
// committed fixture files on 2026-08-14. Shared by the page and social card.
export const SEASON_LAUNCHES = [
  {
    league: "La Liga",
    when: "Matchday 1 — August 15",
    cardWhen: "August 15",
    cardFlex: 0.9,
    first: true,
  },
  {
    league: "Premier League",
    when: "Matchday 1 — August 21",
    cardWhen: "August 21",
    cardFlex: 1.3,
    first: false,
  },
  {
    league: "Ligue 1",
    when: "Matchday 1 — August 21",
    cardWhen: "August 21",
    cardFlex: 0.9,
    first: false,
  },
  {
    league: "Serie A",
    when: "Matchday 1 — August 22",
    cardWhen: "August 22",
    cardFlex: 0.9,
    first: false,
  },
  {
    league: "Bundesliga",
    when: "Matchday 1 — August 28",
    cardWhen: "August 28",
    cardFlex: 1.1,
    first: false,
  },
] as const;
