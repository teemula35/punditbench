import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

// Social card for the league announcement. Without this the route inherits the
// site-wide World Cup card, so August league links unfurl as tournament news.
// Generated at build; works in the static export (same pattern as
// app/matches/[match]). Default font only — satori has no emoji/custom fonts.
export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — the benchmark moves to the European leagues in 2026-27`;

const ACCENT = "#34d399";
const TEXT = "#fafafa";
const MUTED = "#a1a1aa";
const DIM = "#71717a";
const LINE = "#27272a";

// Mirrors the launch calendar on the page itself (dates verified against the
// fixture feeds 2026-07-02). Chronological, so the first column carries the
// "from Aug 16" claim in the kicker. Bundesliga and the Champions League land
// later and ride in the strapline instead of a column.
const LAUNCHES = [
  { league: "La Liga", when: "August 16", flex: 0.9, first: true },
  { league: "Premier League", when: "August 21", flex: 1.3, first: false },
  { league: "Serie A", when: "August 22", flex: 0.9, first: false },
  { league: "Ligue 1", when: "August 22", flex: 0.9, first: false },
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090b",
          color: TEXT,
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: ACCENT,
              fontWeight: 700,
            }}
          >
            Season 2026-27 · from Aug 16
          </div>
          <div style={{ display: "flex", fontSize: 26, color: DIM, letterSpacing: 2 }}>
            {SITE_NAME}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 800, lineHeight: 1.05 }}>
            The benchmark moves to Europe&apos;s top leagues
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: MUTED,
              lineHeight: 1.3,
              marginTop: 20,
              maxWidth: 1000,
            }}
          >
            Every matchday, all models — plus the Bundesliga and Champions League from September.
          </div>
        </div>

        <div style={{ display: "flex", gap: 24 }}>
          {LAUNCHES.map((l) => (
            <div
              key={l.league}
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: l.flex,
                flexBasis: 0,
                borderTop: `3px solid ${l.first ? ACCENT : LINE}`,
                paddingTop: 16,
              }}
            >
              <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: TEXT }}>
                {l.league}
              </div>
              <div style={{ display: "flex", fontSize: 22, color: DIM, marginTop: 8 }}>
                {l.when}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
          <div style={{ display: "flex", color: DIM }}>punditbench.com</div>
          <div style={{ display: "flex", color: ACCENT }}>Picks locked before kickoff</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
