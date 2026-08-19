import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CheckoutCta, type OpeningRoundOfferInput } from "../app/briefs/opening-round-2026/checkout-cta";
import { OpeningRoundBriefCard } from "../app/briefs/opening-round-2026/card";
import OpeningRoundBriefPage, { metadata } from "../app/briefs/opening-round-2026/page";

const completeOffer: OpeningRoundOfferInput = {
  checkoutUrl: "https://buy.stripe.com/test-opening-round",
  sellerName: "Example Seller",
  sellerAddress: "Example Street 1, 00100 Helsinki, Finland",
  supportEmail: "support@example.com",
  vatNotice: "including applicable VAT",
  deliveryMethod: "Email to the address collected at checkout",
  termsUrl: "https://example.com/terms",
  privacyUrl: "https://example.com/privacy",
  refundsUrl: "https://example.com/refunds",
};

describe("opening-round brief checkout", () => {
  it("keeps checkout disabled when the payment link is missing", () => {
    const html = renderToStaticMarkup(<CheckoutCta offer={{}} />);

    expect(html).toContain("Checkout is not open yet");
    expect(html).toContain("payment link is not configured");
    expect(html).not.toContain("href=");
  });

  // The payment link alone arms the checkout; the delivery deadline and
  // refund remedy are always stated with it.
  it("opens checkout with only a valid payment link", () => {
    const html = renderToStaticMarkup(
      <CheckoutCta offer={{ checkoutUrl: completeOffer.checkoutUrl }} />,
    );

    expect(html).toContain('href="https://buy.stripe.com/test-opening-round"');
    expect(html).toContain("Buy the brief for €5");
    expect(html).toContain("Total price: €5");
    expect(html).toContain("3 September 2026");
    expect(html).toContain("full refund");
    expect(html).not.toContain("Checkout is not open yet");
    expect(html).not.toContain("Sold by");
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain("example.com/terms");
  });

  it("renders the full consumer record when it is supplied", () => {
    const html = renderToStaticMarkup(<CheckoutCta offer={completeOffer} />);

    expect(html).toContain('href="https://buy.stripe.com/test-opening-round"');
    expect(html).toContain("Buy the brief for €5");
    expect(html).toContain("Example Seller");
    expect(html).toContain("Example Street 1");
    expect(html).toContain('href="mailto:support@example.com"');
    expect(html).toContain('href="https://example.com/terms"');
    expect(html).toContain('href="https://example.com/privacy"');
    expect(html).toContain('href="https://example.com/refunds"');
    expect(html).toContain("including applicable VAT");
    expect(html).not.toContain("Checkout is not open yet");
  });

  it.each([
    ["javascript:alert(1)"],
    ["https://buy.stripe.com/"],
    ["http://buy.stripe.com/link"],
    ["https://evil.example.com/link"],
    ["   "],
  ] as const)("keeps checkout closed when the payment link is %s", (value) => {
    const html = renderToStaticMarkup(
      <CheckoutCta offer={{ ...completeOffer, checkoutUrl: value }} />,
    );

    expect(html).toContain("Checkout is not open yet");
    expect(html).not.toContain("Buy the brief for €5");
    expect(html).not.toContain("href=");
  });

  it.each([
    ["termsUrl", "http://example.com/terms", "example.com/terms"],
    ["privacyUrl", "not-a-url", "not-a-url"],
    ["supportEmail", "not-an-email", "mailto:"],
  ] as const)("omits an unsafe %s but keeps checkout open", (field, value, absent) => {
    const html = renderToStaticMarkup(
      <CheckoutCta offer={{ ...completeOffer, [field]: value }} />,
    );

    expect(html).toContain("Buy the brief for €5");
    expect(html).not.toContain(absent);
    expect(html).not.toContain("Checkout is not open yet");
  });
});

describe("opening-round brief page", () => {
  it("publishes the complete sample and keeps the unconfigured checkout closed", () => {
    const html = renderToStaticMarkup(<OpeningRoundBriefPage />);

    expect(html).toContain("Five-league opening-round brief");
    expect(html).toContain("€5 once. No subscription.");
    expect(html).toContain("Complete free sample");
    expect(html).toContain("World Cup 2026 round of 16");
    expect(html).toContain("38/40");
    expect(html).toContain("Five highest-consensus calls");
    expect(html).toContain("Lock and hash audit");
    expect(html).toContain("Parser, provider and data issues");
    expect(html).toContain("Checkout is not open yet");
  });

  it("opens the live checkout with only the payment link configured", () => {
    vi.stubEnv("PB_BRIEF_CHECKOUT_URL", completeOffer.checkoutUrl);

    try {
      const html = renderToStaticMarkup(<OpeningRoundBriefPage />);
      expect(html).toContain('href="https://buy.stripe.com/test-opening-round"');
      expect(html).toContain("Buy the brief for €5");
      expect(html).not.toContain("Checkout is not open yet");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("maps the full build-time record into the live checkout", () => {
    const environment = {
      PB_BRIEF_CHECKOUT_URL: completeOffer.checkoutUrl,
      PB_BRIEF_SELLER_NAME: completeOffer.sellerName,
      PB_BRIEF_SELLER_ADDRESS: completeOffer.sellerAddress,
      PB_BRIEF_SUPPORT_EMAIL: completeOffer.supportEmail,
      PB_BRIEF_VAT_NOTICE: completeOffer.vatNotice,
      PB_BRIEF_DELIVERY_METHOD: completeOffer.deliveryMethod,
      PB_BRIEF_TERMS_URL: completeOffer.termsUrl,
      PB_BRIEF_PRIVACY_URL: completeOffer.privacyUrl,
      PB_BRIEF_REFUNDS_URL: completeOffer.refundsUrl,
    };
    for (const [name, value] of Object.entries(environment)) vi.stubEnv(name, value);

    try {
      const html = renderToStaticMarkup(<OpeningRoundBriefPage />);
      expect(html).toContain('href="https://buy.stripe.com/test-opening-round"');
      expect(html).toContain("Buy the brief for €5");
      expect(html).toContain("Example Seller");
      expect(html).not.toContain("Checkout is not open yet");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("sets route-specific sharing metadata", () => {
    expect(metadata.alternates).toEqual({ canonical: "/briefs/opening-round-2026/" });
    expect(metadata.description).toContain("complete free sample");
    expect(metadata.twitter).toMatchObject({
      card: "summary",
      title: "40 models, 304 picks, and one exact score",
    });
  });
});

describe("opening-round homepage card", () => {
  it("links visitors to the free sample before asking for payment", () => {
    const html = renderToStaticMarkup(<OpeningRoundBriefCard />);

    expect(html).toContain('href="/briefs/opening-round-2026"');
    expect(html).toContain("A €5 opening-round brief across five leagues");
    expect(html).toContain("written scorecard");
    expect(html).toContain("complete free sample");
    expect(html).toContain("See the free sample and €5 offer");
    expect(html).toContain("€5 once");
  });
});
