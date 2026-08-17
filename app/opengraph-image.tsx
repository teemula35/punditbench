import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

// Default social card for the whole site (per-route opengraph-image.tsx files
// override this). Generated at build; works in the static export.
export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — five live leagues and the frozen 2026 World Cup archive`;

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
          color: "#fafafa",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 32,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#34d399",
            fontWeight: 700,
          }}
        >
          {SITE_NAME}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 800, lineHeight: 1.1 }}>
            Five European leagues. Predictions locked before kickoff.
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#a1a1aa", marginTop: 20 }}>
            Pre-season tables + form-aware matchday picks
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 28,
            color: "#71717a",
          }}
        >
          <div style={{ display: "flex" }}>punditbench.com</div>
          <div style={{ display: "flex", color: "#34d399" }}>
            World Cup 2026 · frozen archive
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
