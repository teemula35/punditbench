import * as fs from "node:fs";
import * as path from "node:path";
import { verifyOpeningRoundOfferHtml } from "../lib/opening-round-offer-export";

function isStripePaymentLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "buy.stripe.com" && url.pathname.length > 1;
  } catch {
    return false;
  }
}

function fail(message: string): void {
  console.error(message);
  process.exitCode = 1;
}

const checkoutUrl = process.env.PB_BRIEF_CHECKOUT_URL?.trim();

if (checkoutUrl && !isStripePaymentLink(checkoutUrl)) {
  fail("PB_BRIEF_CHECKOUT_URL must be an HTTPS buy.stripe.com payment link with a non-empty path.");
} else if (!checkoutUrl) {
  fail(
    "Refusing to build with the opening-round checkout closed. Set PB_BRIEF_CHECKOUT_URL for a live build.",
  );
} else {
  console.log("validate-opening-round-offer: live checkout configuration present");
}

if (process.argv.includes("--verify-export") && checkoutUrl && process.exitCode !== 1) {
  const exportPath = path.join(
    process.cwd(),
    "out",
    "briefs",
    "opening-round-2026",
    "index.html",
  );

  if (!fs.existsSync(exportPath)) {
    fail(`Opening-round offer export is missing: ${exportPath}`);
  } else {
    const html = fs.readFileSync(exportPath, "utf8");
    const verification = verifyOpeningRoundOfferHtml(html, checkoutUrl);
    if (!verification.ok) {
      fail("Opening-round offer export does not contain the configured live checkout.");
    } else {
      console.log("validate-opening-round-offer: exported live checkout verified");
    }
  }
}
