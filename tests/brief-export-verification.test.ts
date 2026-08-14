import { describe, expect, it } from "vitest";
import { verifyOpeningRoundOfferHtml } from "../lib/opening-round-offer-export";

const checkoutUrl =
  "https://buy.stripe.com/test-opening-round?locale=en&client_reference_id=brief";
const encodedCheckoutUrl =
  "https://buy.stripe.com/test-opening-round?locale=en&amp;client_reference_id=brief";
const buyLabel = "Buy the brief for €5";

function checkoutAnchor(
  attributes = "",
  href = encodedCheckoutUrl,
  label = `Buy the <span>brief</span> for €5`,
): string {
  return `<a ${attributes} href="${href}">${label}</a>`;
}

describe("opening-round offer export verification", () => {
  it("accepts a visible enabled checkout anchor with the exact normalized href and buy label", () => {
    const html = `
      <main>
        ${checkoutAnchor()}
      </main>
    `;

    expect(verifyOpeningRoundOfferHtml(html, checkoutUrl)).toEqual({ ok: true });
  });

  it.each([
    ["comment", `<!-- ${checkoutAnchor()} -->`],
    ["script", `<script>document.body.innerHTML = '${checkoutAnchor()}';</script>`],
    ["style", `<style>.offer::before { content: '${checkoutUrl} ${buyLabel}'; }</style>`],
    ["plain text", `<p>${checkoutUrl} ${buyLabel}</p>`],
  ])("rejects a checkout spoof in %s", (_kind, html) => {
    expect(verifyOpeningRoundOfferHtml(html, checkoutUrl)).toEqual({
      ok: false,
      reason: "missing-live-checkout",
    });
  });

  it.each([
    ["a different payment link", checkoutAnchor("", "https://buy.stripe.com/wrong-link")],
    ["a payment-link prefix", checkoutAnchor("", `${encodedCheckoutUrl}-wrong`)],
    ["extra label text", checkoutAnchor("", encodedCheckoutUrl, `${buyLabel} now`)],
  ])("rejects a checkout anchor with %s", (_kind, anchor) => {
    const html = `<p>Configured URL: ${checkoutUrl}</p>${anchor}`;

    expect(verifyOpeningRoundOfferHtml(html, checkoutUrl)).toEqual({
      ok: false,
      reason: "missing-live-checkout",
    });
  });

  it.each([
    ["hidden attribute", checkoutAnchor("hidden")],
    ["aria-hidden", checkoutAnchor('aria-hidden="true"')],
    ["inline display", checkoutAnchor('style="display: none"')],
    ["hidden class", checkoutAnchor('class="cta hidden"')],
    ["disabled attribute", checkoutAnchor("disabled")],
    ["aria-disabled", checkoutAnchor('aria-disabled="true"')],
    ["inert attribute", checkoutAnchor("inert")],
    ["hidden container", `<section hidden>${checkoutAnchor()}</section>`],
    ["disabled container", `<section inert>${checkoutAnchor()}</section>`],
    [
      "hidden label descendant",
      checkoutAnchor("", encodedCheckoutUrl, `<span hidden>${buyLabel}</span>`),
    ],
    [
      "hidden nested label container",
      checkoutAnchor(
        "",
        encodedCheckoutUrl,
        `<span hidden><span>${buyLabel}</span></span>`,
      ),
    ],
    [
      "disabled label descendant",
      checkoutAnchor(
        "",
        encodedCheckoutUrl,
        `<span aria-disabled="true">${buyLabel}</span>`,
      ),
    ],
    ["closed dialog container", `<dialog>${checkoutAnchor()}</dialog>`],
    ["closed popover container", `<section popover>${checkoutAnchor()}</section>`],
    ["decimal zero opacity", checkoutAnchor('style="opacity: 0.0"')],
    ["percentage zero opacity", checkoutAnchor('style="opacity: 0%"')],
    [
      "comment-obfuscated hidden display",
      checkoutAnchor('style="display: none/* hidden */"'),
    ],
    [
      "invalid display declaration after hidden display",
      checkoutAnchor('style="display: none; display: not-a-display"'),
    ],
    [
      "invalid important display after hidden important display",
      checkoutAnchor(
        'style="display: none !important; display: not-a-display !important"',
      ),
    ],
    [
      "closed details content container",
      `<details><summary>Offer</summary>${checkoutAnchor()}</details>`,
    ],
  ])("rejects a checkout anchor with a %s", (_kind, html) => {
    expect(verifyOpeningRoundOfferHtml(html, checkoutUrl)).toEqual({
      ok: false,
      reason: "missing-live-checkout",
    });
  });

  it.each([
    ["open dialog", `<dialog open>${checkoutAnchor()}</dialog>`],
    [
      "open details content",
      `<details open><summary>Offer</summary>${checkoutAnchor()}</details>`,
    ],
    [
      "closed details summary",
      `<details><summary>${checkoutAnchor()}</summary><p>Hidden content</p></details>`,
    ],
  ])("accepts a checkout anchor in %s", (_kind, html) => {
    expect(verifyOpeningRoundOfferHtml(html, checkoutUrl)).toEqual({ ok: true });
  });

  describe.each([
    ["display", "block", "none"],
    ["visibility", "visible", "hidden"],
    ["opacity", "1", "0"],
    ["pointer-events", "auto", "none"],
  ])("inline %s declaration cascade", (property, visibleValue, hiddenValue) => {
    it.each([
      ["uses the last non-important declaration when it hides", visibleValue, hiddenValue, false],
      ["uses the last non-important declaration when it shows", hiddenValue, visibleValue, true],
      ["keeps an earlier hidden important declaration", `${hiddenValue} !important`, visibleValue, false],
      ["uses a later visible important declaration", hiddenValue, `${visibleValue} !important`, true],
      ["keeps an earlier visible important declaration", `${visibleValue} !important`, hiddenValue, true],
      ["uses a later hidden important declaration", visibleValue, `${hiddenValue} !important`, false],
      [
        "uses the last important declaration when it shows",
        `${hiddenValue} !important`,
        `${visibleValue} !important`,
        true,
      ],
      [
        "uses the last important declaration when it hides",
        `${visibleValue} !important`,
        `${hiddenValue} !important`,
        false,
      ],
    ])("%s", (_case, firstValue, secondValue, accepted) => {
      const html = checkoutAnchor(
        `style="${property}: ${firstValue}; ${property}: ${secondValue}"`,
      );

      expect(verifyOpeningRoundOfferHtml(html, checkoutUrl)).toEqual(
        accepted ? { ok: true } : { ok: false, reason: "missing-live-checkout" },
      );
    });
  });

  it("rejects an export that also contains the checkout-closed fallback", () => {
    const html = `${checkoutAnchor()}<h2>Checkout is not open yet</h2>`;

    expect(verifyOpeningRoundOfferHtml(html, checkoutUrl)).toEqual({
      ok: false,
      reason: "closed-fallback",
    });
  });

  it("does not treat closed-fallback text in comments or script/style content as rendered", () => {
    const html = `
      <!-- Checkout is not open yet -->
      <script>const closed = "Checkout is not open yet";</script>
      <style>.offer::before { content: "Checkout is not open yet"; }</style>
      ${checkoutAnchor()}
    `;

    expect(verifyOpeningRoundOfferHtml(html, checkoutUrl)).toEqual({ ok: true });
  });
});
