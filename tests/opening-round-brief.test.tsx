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
  it("keeps checkout disabled when public consumer details are missing", () => {
    const html = renderToStaticMarkup(<CheckoutCta offer={{}} />);

    expect(html).toContain("Checkout is not open yet");
    expect(html).toContain("consumer and refund details");
    expect(html).not.toContain("href=");
  });

  it("opens checkout only with the complete public consumer record", () => {
    const html = renderToStaticMarkup(<CheckoutCta offer={completeOffer} />);

    expect(html).toContain('href="https://buy.stripe.com/test-opening-round"');
    expect(html).toContain("Buy the brief for €5");
    expect(html).toContain("Example Seller");
    expect(html).toContain("Example Street 1");
    expect(html).toContain('href="mailto:support@example.com"');
    expect(html).toContain('href="https://example.com/terms"');
    expect(html).toContain('href="https://example.com/privacy"');
    expect(html).toContain('href="https://example.com/refunds"');
    expect(html).not.toContain("Checkout is not open yet");
  });

  it.each([
    ["checkoutUrl", "javascript:alert(1)"],
    ["checkoutUrl", "https://buy.stripe.com/"],
    ["termsUrl", "http://example.com/terms"],
    ["privacyUrl", "not-a-url"],
    ["supportEmail", "not-an-email"],
    ["sellerName", "   "],
  ] as const)("keeps checkout closed when %s is unsafe", (field, value) => {
    const html = renderToStaticMarkup(
      <CheckoutCta offer={{ ...completeOffer, [field]: value }} />,
    );

    expect(html).toContain("Checkout is not open yet");
    expect(html).not.toContain("Buy the brief for €5");
    expect(html).not.toContain("href=");
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

  it("maps the approved build-time record into the live checkout", () => {
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
    expect(html).toContain("Read the complete free sample");
    expect(html).toContain("€5 once");
  });
});
