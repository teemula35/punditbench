import { ImageResponse } from "next/og";
import { liveOutcomeSplit, loadSiteData } from "@/lib/aggregate";
import { loadFixtures } from "@/lib/data";
import { SITE_NAME } from "@/lib/site";
import { STAGE_LABELS } from "@/lib/types";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "PunditBench match card";

export function generateStaticParams() {
  return loadFixtures().map((f) => ({ match: String(f.match) }));
}

export default async function Image({ params }: { params: Promise<{ match: string }> }) {
  const { match } = await params;
  const data = loadSiteData();
  const fixture = data.fixtures.get(Number(match));

  // Fallback to the default card if the fixture is somehow missing.
  const home = fixture?.home ?? SITE_NAME;
  const away = fixture?.away ?? "";
  const stageLabel = fixture ? STAGE_LABELS[fixture.stage] : "2026 World Cup";
  const result = fixture ? data.results.get(fixture.match) : undefined;
  const played =
    result?.status === "final" &&
    result.home_goals !== undefined &&
    result.away_goals !== undefined;
  const score = played ? `${result!.home_goals}–${result!.away_goals}` : "vs";

  // Round-by-round consensus headline — the shareable "was the crowd right?" line.
  const split = fixture ? liveOutcomeSplit(data, fixture) : undefined;
  let crowd = "";
  if (split && split.outOf > 0) {
    const { home: h, draw: d, away: a, outOf } = split;
    if (h >= d && h >= a) crowd = `${h} of ${outOf} models backed ${home}`;
    else if (a >= d && a >= h) crowd = `${a} of ${outOf} models backed ${away}`;
    else crowd = `${d} of ${outOf} models predicted a draw`;
  }

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
          color: "#fafafa",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#34d399",
              fontWeight: 700,
            }}
          >
            {stageLabel}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#71717a", letterSpacing: 2 }}>
            {SITE_NAME}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
            <div style={{ display: "flex", fontSize: 58, fontWeight: 800, maxWidth: 420, justifyContent: "flex-end" }}>
              {home}
            </div>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#34d399" }}>{score}</div>
            <div style={{ display: "flex", fontSize: 58, fontWeight: 800, maxWidth: 420 }}>{away}</div>
          </div>
          {played && result?.advances ? (
            <div style={{ display: "flex", fontSize: 30, color: "#a1a1aa", marginTop: 22 }}>
              {result.advances} advance{result.note ? ` · ${result.note}` : ""}
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 28, color: "#a1a1aa", marginTop: 22 }}>
              40 LLMs · picks pre-registered before kickoff
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 27 }}>
          <div style={{ display: "flex", color: "#34d399" }}>{crowd || "punditbench.com"}</div>
          <div style={{ display: "flex", color: "#71717a" }}>{crowd ? "punditbench.com" : ""}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
