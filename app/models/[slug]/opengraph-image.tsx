import { ImageResponse } from "next/og";
import { loadSiteData } from "@/lib/aggregate";
import { loadRoster } from "@/lib/data";
import { modelSlug } from "@/lib/prompt";
import { reportCardFor } from "@/lib/report-card";
import { SITE_NAME } from "@/lib/site";

// Per-model social card: the model's end-of-tournament report card. Generated
// at build; works in the static export (see app/matches/[match] for the same
// pattern). Default font only — satori has no emoji/custom fonts here.
export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} model report card`;

export function generateStaticParams() {
  return loadRoster().map((m) => ({ slug: modelSlug(m.id) }));
}

const ACCENT = "#34d399";
const TEXT = "#fafafa";
const MUTED = "#a1a1aa";
const DIM = "#71717a";
const LINE = "#27272a";
const MISS = "#fda4af";

/**
 * Costs span four orders of magnitude across the roster. The $0.10 cutoff
 * mirrors costPhrase() in lib/report-card, so the stat never disagrees with the
 * dollar figure the verdict quotes.
 */
function money(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0.00";
  if (usd >= 0.1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  if (usd >= 0.0001) return `$${usd.toFixed(4).replace(/0+$/, "")}`;
  return "<$0.0001";
}

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 3).trimEnd()}...`;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = loadSiteData();
  const card = reportCardFor(data, slug);
  // Fall back to the roster row if the report card can't be built, so the card
  // still renders as a branded, named model page rather than a blank frame.
  const model = data.roster.find((m) => modelSlug(m.id) === slug);

  const label = card?.label ?? model?.label ?? SITE_NAME;
  const kicker = [card?.vendor ?? model?.vendor, card?.tier ?? model?.tier]
    .filter(Boolean)
    .join(" · ");
  const verdict = clip(
    card?.verdict ?? "One of 40 LLMs that predicted the entire 2026 World Cup before a ball was kicked.",
    150,
  );

  const champCorrect = card?.championCorrect === true;
  // Stats only exist with a report card; without one the row is dropped rather
  // than rendered as four empty dashes.
  const stats = card
    ? [
        {
          key: "champion",
          label: "Champion pick",
          value: card.championPick ?? "None",
          valueColor: champCorrect ? ACCENT : TEXT,
          note:
            card.championPick === undefined
              ? "no valid bracket"
              : champCorrect
                ? "Correct"
                : card.championFate
                  ? clip(card.championFate, 32)
                  : "Wrong",
          noteColor: champCorrect ? ACCENT : card.championPick === undefined ? DIM : MISS,
          // Champion gets the widest column — team names run long.
          border: champCorrect ? ACCENT : LINE,
          flex: 1.5,
        },
        {
          key: "locked",
          label: "Locked rank",
          value: `#${card.lockedRank}`,
          valueColor: TEXT,
          note: `${card.lockedPoints} pts · ${card.exactCount} exact`,
          noteColor: DIM,
          border: LINE,
          flex: 1,
        },
        {
          key: "live",
          label: "Round by round",
          value: card.liveRank !== undefined ? `#${card.liveRank}` : "—",
          valueColor: TEXT,
          note: card.livePoints !== undefined ? `${card.livePoints} pts` : "no live picks",
          noteColor: DIM,
          border: LINE,
          flex: 1,
        },
        {
          key: "cost",
          label: "Cost",
          value: money(card.costUsd),
          valueColor: TEXT,
          note: "whole tournament",
          noteColor: DIM,
          border: LINE,
          flex: 1,
        },
      ]
    : [];

  const heroSize =
    label.length > 24 ? 64 : label.length > 21 ? 76 : label.length > 17 ? 84 : 90;

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
        {/* Vendor · tier, with the site wordmark opposite */}
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
            {kicker || "Model report card"}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: DIM, letterSpacing: 2 }}>
            {SITE_NAME}
          </div>
        </div>

        {/* Hero: the model name, then the one-line verdict */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: heroSize, fontWeight: 800, lineHeight: 1.05 }}>
            {label}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              color: MUTED,
              lineHeight: 1.3,
              marginTop: 20,
              maxWidth: 1000,
            }}
          >
            {verdict}
          </div>
        </div>

        {/* Compact stat row */}
        {stats.length === 0 ? null : (
          <div style={{ display: "flex", gap: 24 }}>
            {stats.map((s) => (
              <div
                key={s.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flexGrow: s.flex,
                  flexBasis: 0,
                  borderTop: `3px solid ${s.border}`,
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 20,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: DIM,
                    fontWeight: 600,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 40,
                    fontWeight: 800,
                    color: s.valueColor,
                    marginTop: 8,
                  }}
                >
                  {s.value}
                </div>
                <div style={{ display: "flex", fontSize: 21, color: s.noteColor, marginTop: 6 }}>
                  {s.note}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
          <div style={{ display: "flex", color: DIM }}>punditbench.com</div>
          <div style={{ display: "flex", color: ACCENT }}>Picks locked before kickoff</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
