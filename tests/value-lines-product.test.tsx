import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AvailabilityBoard } from "../app/value-lines/availability-board";
import {
  ValueLineCheckoutCta,
  VerifiedSellerNotice,
} from "../app/value-lines/checkout-cta";
import { HistoricalForecastCard } from "../app/value-lines/forecast-card";
import ValueLinesPage, { metadata } from "../app/value-lines/page";
import {
  HISTORICAL_VALUE_LINE_SAMPLE,
  VALUE_LINE_LEAGUES,
  VALUE_LINE_REQUIRED_CONFIG_FIELDS,
  betFromOdds,
  fairOdds,
  loadValueLineAvailability,
  validateValueLineCheckout,
  type ValueLineCheckoutInput,
} from "../lib/value-line-product";

const productionShapedOffer: ValueLineCheckoutInput = {
  checkoutUrl: "https://buy.stripe.com/7sIaEW4vB8qL2mN5kR",
  stripeAccountId: "acct_1PBVLines9EUR",
  stripeProductId: "prod_PBVLines2026",
  stripePriceId: "price_PBVLinesEUR9Month",
  stripeUnitAmountCents: "900",
  stripeCurrency: "EUR",
  stripeInterval: "month",
  stripeMode: "live",
  sellerLegalName: "Northern Metrics Oy",
  sellerBusinessId: "FI-9274610-4",
  sellerAddressLine1: "Esplanadi 42",
  sellerPostalCode: "00130",
  sellerCity: "Helsinki",
  sellerCountryCode: "FI",
  taxNotice: "€9 monthly including applicable tax",
  taxReviewed: "confirmed",
  supportEmail: "support@punditbench.com",
  contactUrl: "https://punditbench.com/contact/",
  deliveryMethod: "Issues are delivered by email and subscriber dashboard",
  emailProvider: "Resend",
  emailSender: "issues@updates.punditbench.com",
  emailSendingDomain: "updates.punditbench.com",
  emailDomainVerified: "verified",
  emailProviderClearance: "approved",
  termsUrl: "https://punditbench.com/value-lines/terms/",
  privacyUrl: "https://punditbench.com/value-lines/privacy/",
  refundsUrl: "https://punditbench.com/value-lines/refunds/",
  responsiblePlayUrl: "https://punditbench.com/responsible-play/",
  serviceBaseUrl: "https://members.punditbench.com",
  returnUrl: "https://members.punditbench.com/checkout/complete",
  cancelUrl: "https://members.punditbench.com/checkout/cancelled",
  activation: "enabled",
};

const fakeTestOffer: ValueLineCheckoutInput = {
  checkoutUrl: "https://buy.stripe.com/test_value_lines",
  stripeAccountId: "acct_testValueLines",
  stripeProductId: "prod_testValueLines",
  stripePriceId: "price_testValueLines",
  stripeUnitAmountCents: "900",
  stripeCurrency: "EUR",
  stripeInterval: "month",
  stripeMode: "test",
  sellerLegalName: "Example Seller",
  sellerBusinessId: "TEST-12345",
  sellerAddressLine1: "1 Example Street",
  sellerPostalCode: "EX1 1AA",
  sellerCity: "Example City",
  sellerCountryCode: "GB",
  taxNotice: "€9 monthly including test tax",
  taxReviewed: "confirmed",
  supportEmail: "support@example.com",
  contactUrl: "https://example.com/contact",
  deliveryMethod: "Test issues are delivered by email",
  emailProvider: "Test Mail",
  emailSender: "issues@mail.example.com",
  emailSendingDomain: "mail.example.com",
  emailDomainVerified: "verified",
  emailProviderClearance: "approved",
  termsUrl: "https://example.com/terms",
  privacyUrl: "https://example.com/privacy",
  refundsUrl: "https://example.com/refunds",
  responsiblePlayUrl: "https://example.com/responsible-play",
  serviceBaseUrl: "https://members.example.com",
  returnUrl: "https://members.example.com/checkout/complete",
  cancelUrl: "https://members.example.com/checkout/cancelled",
  activation: "test-enabled",
};

describe("value-line product contract", () => {
  it("publishes exactly the five promised leagues and recurring price", () => {
    const html = renderToStaticMarkup(<ValueLinesPage />);

    expect(VALUE_LINE_LEAGUES.map(({ name }) => name)).toEqual([
      "Premier League",
      "La Liga",
      "Serie A",
      "Ligue 1",
      "Bundesliga",
    ]);
    for (const { name } of VALUE_LINE_LEAGUES) expect(html).toContain(name);
    expect(html).toContain("€9/month");
    expect(html).toContain("recurring");
    expect(html).toContain("England, Scotland and Wales");
    expect(html.match(/Not betting advice\./g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).not.toContain("buy.stripe.com");
  });

  it("shows all three accessible 1/X/2 sample panels and the frozen worked math", () => {
    const html = renderToStaticMarkup(<HistoricalForecastCard />);

    expect(html).toContain("Historical sample · forecast-card.v1");
    expect(html).toContain("Historical demonstration only. Not betting advice.");
    expect(html).toContain('aria-label="Historical 1 X 2 value-line outcomes"');
    expect(html).toContain("26/50 · 52%");
    expect(html).toContain("14/50 · 28%");
    expect(html).toContain("10/50 · 20%");
    for (const threshold of ["2.02", "3.75", "5.25"]) expect(html).toContain(threshold);
    expect(HISTORICAL_VALUE_LINE_SAMPLE.map(({ fairOdds }) => fairOdds)).toEqual([1.92, 3.57, 5]);
    expect(HISTORICAL_VALUE_LINE_SAMPLE.map(({ betFrom }) => betFrom)).toEqual([2.02, 3.75, 5.25]);
    expect(fairOdds(0.52)).toBe(1.92);
    expect(betFromOdds(0.52)).toBe(2.02);
    expect(0.52 * 2.02 - 1).toBeGreaterThanOrEqual(0.05);
    expect(0.52 * 2.01 - 1).toBeLessThan(0.05);
  });

  it("reads the real checked-in schedule and exposes a source/status for each covered league", () => {
    const rows = loadValueLineAvailability(new Date("2026-08-24T12:00:00Z"));

    expect(rows).toHaveLength(5);
    expect(rows.map(({ league }) => league)).toEqual(VALUE_LINE_LEAGUES.map(({ name }) => name));
    for (const row of rows) {
      expect(row.fixture).toBeTruthy();
      expect(row.kickoff).toContain("UTC");
      expect(row.sourceHref).toMatch(/^\/leagues\/.+\/matches\/\d+\/$/);
    }
    expect(rows.some(({ state }) => state === "eligible")).toBe(true);
    expect(rows.some(({ state }) => state === "awaiting-lock")).toBe(true);
  });

  it("renders explicit empty, unavailable, postponed and expired states", () => {
    const html = renderToStaticMarkup(<AvailabilityBoard rows={[]} asOf="2026-08-24T12:00:00Z" />);

    expect(html).toContain("No upcoming fixtures are available");
    expect(html).toContain("Unavailable");
    expect(html).toContain("Postponed");
    expect(html).toContain("Expired");
  });

  it("sets route-specific metadata", () => {
    expect(metadata.alternates).toEqual({ canonical: "/value-lines/" });
    expect(metadata.description).toContain("1/X/2");
  });
});

describe("value-line checkout fail-closed controls", () => {
  it("renders checkout only when every production control validates", () => {
    const html = renderToStaticMarkup(<ValueLineCheckoutCta offer={productionShapedOffer} />);

    expect(html).toContain(`href="${productionShapedOffer.checkoutUrl}"`);
    expect(html).toContain("Subscribe for €9/month");
    expect(html).toContain("recurring until cancelled");
    expect(html).toContain("Verified seller identity and geographic address");
    expect(html).toContain("Not betting advice.");
    expect(html).not.toContain("Checkout unavailable");
    expect(html).not.toContain(productionShapedOffer.sellerLegalName);
    expect(html).not.toContain(productionShapedOffer.sellerBusinessId);
    expect(html).not.toContain(productionShapedOffer.sellerAddressLine1);
  });

  it.each(VALUE_LINE_REQUIRED_CONFIG_FIELDS)(
    "fails closed when %s is independently missing",
    (field) => {
      const offer = { ...productionShapedOffer } as Partial<ValueLineCheckoutInput>;
      delete offer[field];
      const html = renderToStaticMarkup(<ValueLineCheckoutCta offer={offer} />);

      expect(html).toContain("Checkout unavailable");
      expect(html).toContain("disabled");
      expect(html).not.toContain("href=");
      expect(html).toContain("Not betting advice.");
    },
  );

  it("allows complete fake values only through the test validator, never the production CTA", () => {
    expect(validateValueLineCheckout(fakeTestOffer, { allowTestValues: true })).toEqual({
      ready: true,
      invalidFields: [],
    });
    expect(validateValueLineCheckout(fakeTestOffer).ready).toBe(false);

    const html = renderToStaticMarkup(<ValueLineCheckoutCta offer={fakeTestOffer} />);
    expect(html).toContain("Checkout unavailable");
    expect(html).not.toContain("href=");
  });

  it.each([
    ["stripeUnitAmountCents", "899"],
    ["stripeUnitAmountCents", "9"],
    ["stripeCurrency", "GBP"],
    ["stripeCurrency", "eur"],
    ["stripeInterval", "year"],
    ["stripeInterval", "monthly"],
  ] as const)("rejects the mismatched price control %s=%s", (field, value) => {
    expect(validateValueLineCheckout({ ...productionShapedOffer, [field]: value }).ready).toBe(false);
  });

  it.each([
    ["stripeMode", "test"],
    ["activation", "test-enabled"],
    ["taxReviewed", "pending"],
    ["emailDomainVerified", "pending"],
    ["emailProviderClearance", "pending"],
  ] as const)("rejects non-live confirmation %s=%s", (field, value) => {
    expect(validateValueLineCheckout({ ...productionShapedOffer, [field]: value }).ready).toBe(false);
  });

  it.each([
    ["checkoutUrl", "https://buy.stripe.com/test_value_lines"],
    ["stripeAccountId", "acct_testValueLines"],
    ["stripeProductId", "prod_testValueLines"],
    ["stripePriceId", "price_testValueLines"],
    ["sellerLegalName", "Example Seller"],
    ["sellerAddressLine1", "1 Example Street"],
    ["emailProvider", "Test Mail"],
    ["termsUrl", "https://example.com/terms"],
    ["serviceBaseUrl", "https://members.example.com"],
  ] as const)("rejects production placeholder %s", (field, value) => {
    expect(validateValueLineCheckout({ ...productionShapedOffer, [field]: value }).ready).toBe(false);
  });

  it.each([
    ["returnUrl", "https://punditbench.com/checkout/complete"],
    ["cancelUrl", "https://punditbench.com/checkout/cancelled"],
    ["returnUrl", "https://members.punditbench.com"],
    ["cancelUrl", "http://members.punditbench.com/checkout/cancelled"],
  ] as const)("rejects an unapproved callback in %s", (field, value) => {
    expect(validateValueLineCheckout({ ...productionShapedOffer, [field]: value }).ready).toBe(false);
  });

  it("rejects a sender that does not match the verified sending domain", () => {
    expect(
      validateValueLineCheckout({
        ...productionShapedOffer,
        emailSender: "issues@other.punditbench.com",
      }).ready,
    ).toBe(false);
  });

  it.each([
    ["checkoutUrl", "https://example.com/pay"],
    ["stripePriceId", "prod_not_a_price"],
    ["supportEmail", "not-an-email"],
    ["termsUrl", "http://example.com/terms"],
    ["serviceBaseUrl", "javascript:alert(1)"],
    ["activation", "true"],
  ] as const)("fails closed when %s is invalid", (field, value) => {
    const html = renderToStaticMarkup(
      <ValueLineCheckoutCta offer={{ ...productionShapedOffer, [field]: value }} />,
    );

    expect(html).toContain("Checkout unavailable");
    expect(html).not.toContain("href=");
  });

  it("keeps the current empty build technically closed", () => {
    const checkout = renderToStaticMarkup(<ValueLineCheckoutCta offer={{}} />);
    const sellerNotice = renderToStaticMarkup(<VerifiedSellerNotice />);

    expect(checkout).toContain("disabled");
    expect(checkout).not.toContain("href=");
    expect(sellerNotice).toContain(
      "Verified seller identity and geographic address are shown on the hosted checkout",
    );
  });
});
