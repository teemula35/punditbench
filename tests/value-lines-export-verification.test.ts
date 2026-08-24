import { describe, expect, it } from "vitest";
import {
  verifyClosedValueLineOfferHtml,
  verifyValueLineOfferHtml,
} from "../lib/value-line-offer-export";

const serviceBaseUrl = "https://members.punditbench.com";
const checkoutUrl = `${serviceBaseUrl}/checkout/start`;
const subscribeLabel = "Subscribe for €9/month";

function checkoutAnchor(
  attributes = "",
  href = "https://MEMBERS.PUNDITBENCH.COM/checkout/start",
  label = "Subscribe for <span>€9/month</span>",
): string {
  return `<a ${attributes} href="${href}">${label}</a>`;
}

describe("Value Lines offer export verification", () => {
  it("accepts only the exact normalized checkout href and exact visible subscription label", () => {
    expect(verifyValueLineOfferHtml(`<main>${checkoutAnchor()}</main>`, checkoutUrl)).toEqual({
      ok: true,
    });
  });

  it("rejects a live export that also exposes a direct Stripe payment bypass", () => {
    const html = `<main>${checkoutAnchor()}<a href="https://buy.stripe.com/direct">Pay directly</a></main>`;

    expect(verifyValueLineOfferHtml(html, checkoutUrl)).toEqual({
      ok: false,
      reason: "forbidden-checkout-host",
    });
  });

  it.each([
    ["comment", `<!-- ${checkoutAnchor()} -->`],
    [
      "script",
      `<script>const checkout = ${JSON.stringify(checkoutUrl)}; const label = ${JSON.stringify(subscribeLabel)};</script>`,
    ],
    ["style", `<style>.offer::before { content: '${checkoutUrl} ${subscribeLabel}'; }</style>`],
    ["ordinary text", `<p>${checkoutUrl} ${subscribeLabel}</p>`],
  ])("rejects a checkout spoof in %s", (_kind, html) => {
    expect(verifyValueLineOfferHtml(html, checkoutUrl)).toEqual({
      ok: false,
      reason: "missing-live-checkout",
    });
  });

  it.each([
    ["another private-service destination", checkoutAnchor("", `${serviceBaseUrl}/wrong`)],
    ["a destination prefix", checkoutAnchor("", `${checkoutUrl}-decoy`)],
    ["a query-bearing destination", checkoutAnchor("", `${checkoutUrl}?customer=secret`)],
    ["a fragment-bearing destination", checkoutAnchor("", `${checkoutUrl}#decoy`)],
    ["a decoy local path", checkoutAnchor("", "/value-lines/checkout")],
    ["extra label text", checkoutAnchor("", checkoutUrl, `${subscribeLabel} now`)],
    ["a different label", checkoutAnchor("", checkoutUrl, "Subscribe now")],
  ])("rejects a control with %s", (_kind, html) => {
    expect(verifyValueLineOfferHtml(html, checkoutUrl)).toEqual({
      ok: false,
      reason: "missing-live-checkout",
    });
  });

  it.each([
    ["hidden attribute", checkoutAnchor("hidden")],
    ["disabled attribute", checkoutAnchor("disabled")],
    ["aria-hidden state", checkoutAnchor('aria-hidden="true"')],
    ["aria-disabled state", checkoutAnchor('aria-disabled="true"')],
    ["inert state", checkoutAnchor("inert")],
    ["inline hidden display", checkoutAnchor('style="display: none"')],
    ["inline disabled pointer events", checkoutAnchor('style="pointer-events: none"')],
    ["hidden utility class", checkoutAnchor('class="cta hidden"')],
    ["hidden ancestor", `<section hidden>${checkoutAnchor()}</section>`],
    ["disabled ancestor", `<section inert>${checkoutAnchor()}</section>`],
    [
      "hidden label descendant",
      checkoutAnchor("", checkoutUrl, `<span hidden>${subscribeLabel}</span>`),
    ],
  ])("rejects a checkout control with %s", (_kind, html) => {
    expect(verifyValueLineOfferHtml(html, checkoutUrl)).toEqual({
      ok: false,
      reason: "missing-live-checkout",
    });
  });

  it("rejects a live control when the rendered closed fallback is also present", () => {
    const html = `${checkoutAnchor()}<p>Checkout unavailable</p>`;

    expect(verifyValueLineOfferHtml(html, checkoutUrl)).toEqual({
      ok: false,
      reason: "closed-fallback",
    });
  });

  it("rejects a live control when a disabled closed-state control remains rendered", () => {
    const html = `${checkoutAnchor()}<button disabled>Checkout unavailable</button>`;

    expect(verifyValueLineOfferHtml(html, checkoutUrl)).toEqual({
      ok: false,
      reason: "closed-fallback",
    });
  });

  it("ignores closed-fallback text in comments, scripts, and styles", () => {
    const html = `
      <!-- Checkout unavailable -->
      <script>const closed = "Checkout unavailable";</script>
      <style>.offer::before { content: "Checkout unavailable"; }</style>
      ${checkoutAnchor()}
    `;

    expect(verifyValueLineOfferHtml(html, checkoutUrl)).toEqual({ ok: true });
  });

  it("accepts a structurally closed export with a rendered disabled fallback", () => {
    const html = `<section><p>Checkout unavailable</p><button disabled>Checkout unavailable</button></section>`;

    expect(verifyClosedValueLineOfferHtml(html, serviceBaseUrl)).toEqual({ ok: true });
  });

  it.each([
    ["missing fallback", "<main>Value Lines</main>"],
    ["script fallback", '<script>const state = "Checkout unavailable";</script>'],
    ["style fallback", '<style>.offer::before { content: "Checkout unavailable"; }</style>'],
    ["live control", checkoutAnchor()],
    [
      "renamed private-service control plus fallback",
      `${checkoutAnchor("", checkoutUrl, "Pay now")}<p>Checkout unavailable</p>`,
    ],
    [
      "protocol-relative Stripe control plus fallback",
      `${checkoutAnchor("", "//buy.stripe.com/pay", "Pay now")}<p>Checkout unavailable</p>`,
    ],
    [
      "trailing-dot Stripe control plus fallback",
      `${checkoutAnchor("", "https://buy.stripe.com./pay", "Pay now")}<p>Checkout unavailable</p>`,
    ],
    [
      "SVG private-service control plus fallback",
      `<svg><a href="${checkoutUrl}"><text>Pay now</text></a></svg><p>Checkout unavailable</p>`,
    ],
    ["live control plus fallback", `${checkoutAnchor()}<p>Checkout unavailable</p>`],
  ])("rejects a closed export with %s", (_kind, html) => {
    expect(verifyClosedValueLineOfferHtml(html, serviceBaseUrl)).toEqual({
      ok: false,
      reason: "missing-closed-fallback",
    });
  });

  it("rejects a renamed checkout control on the configured private service origin", () => {
    const alternateServiceBaseUrl = "https://secure.punditbench.com";
    const html = `${checkoutAnchor("", `${alternateServiceBaseUrl}/subscribe`, "Continue")}<p>Checkout unavailable</p>`;

    expect(verifyClosedValueLineOfferHtml(html, alternateServiceBaseUrl)).toEqual({
      ok: false,
      reason: "missing-closed-fallback",
    });
  });
});
