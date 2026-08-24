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
import ValueLinePolicyLinks from "../app/value-lines/policy-links";
import {
  HISTORICAL_VALUE_LINE_SAMPLE,
  VALUE_LINE_LEAGUES,
  VALUE_LINE_REQUIRED_CONFIG_FIELDS,
  betFromOdds,
  fairOdds,
  loadValueLineAvailability,
  validateValueLineCheckout,
  type ValueLineAvailability,
  type ValueLineAvailabilityState,
  type ValueLineCheckoutInput,
} from "../lib/value-line-product";

const productionShapedOffer: ValueLineCheckoutInput = {
  checkoutUrl: "https://members.punditbench.com/checkout/start",
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
  supportEmail: "support@punditbench.com",
  contactUrl: "https://punditbench.com/contact/",
  deliveryMethod: "Issues are delivered by email and subscriber dashboard",
  emailProvider: "Resend",
  emailSender: "issues@updates.punditbench.com",
  emailSendingDomain: "updates.punditbench.com",
  emailDomainVerified: "verified",
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
  checkoutUrl: "https://members.example.com/checkout/start",
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
  supportEmail: "support@example.com",
  contactUrl: "https://example.com/contact",
  deliveryMethod: "Test issues are delivered by email",
  emailProvider: "Test Mail",
  emailSender: "issues@mail.example.com",
  emailSendingDomain: "mail.example.com",
  emailDomainVerified: "verified",
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
    expect(html).toContain(
      "18+ only. You must be resident in England, Scotland or Wales and must not be physically in Finland when purchasing or using Value Lines.",
    );
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

  it("reads the real checked-in schedule with a valid explicit source/status contract", () => {
    const rows = loadValueLineAvailability(new Date("2026-08-24T12:00:00Z"));
    const explicitStates = [
      "eligible",
      "awaiting-lock",
      "unavailable",
      "postponed",
      "expired",
    ] as const satisfies readonly ValueLineAvailabilityState[];

    expect(rows).toHaveLength(5);
    expect(rows.map(({ league }) => league)).toEqual(VALUE_LINE_LEAGUES.map(({ name }) => name));
    for (const row of rows) {
      expect(explicitStates).toContain(row.state);
      expect(row.status.trim()).not.toBe("");
      expect(row.fixture).toBeTruthy();
      expect(row.kickoff).toContain("UTC");
      expect(row.sourceHref).toMatch(/^\/leagues\/.+\/matches\/\d+\/$/);
    }
  });

  it("renders the explicit empty availability state", () => {
    const html = renderToStaticMarkup(<AvailabilityBoard rows={[]} asOf="2026-08-24T12:00:00Z" />);

    expect(html).toContain("No upcoming fixtures are available");
  });

  it.each([
    ["eligible", "Eligible", "Synthetic eligible status", 25],
    ["awaiting-lock", "Awaiting lock", "Synthetic awaiting-lock status", null],
    ["unavailable", "Unavailable", "Synthetic unavailable status", 12],
    ["postponed", "Postponed", "Synthetic postponed status", null],
    ["expired", "Expired", "Synthetic expired status", null],
  ] as const)("renders a synthetic %s availability row", (state, label, status, votes) => {
    const row: ValueLineAvailability = {
      competitionId: `synthetic-${state}`,
      league: "Synthetic League",
      fixture: state === "expired" ? null : "Home FC vs Away FC",
      match: state === "expired" ? null : 42,
      kickoff: state === "expired" ? null : "24 Aug 2026 · 18:00 UTC",
      state,
      status,
      votes,
      sourceHref: state === "expired" ? null : "/leagues/synthetic/matches/42/",
    };
    const html = renderToStaticMarkup(
      <AvailabilityBoard rows={[row]} asOf="2026-08-24T12:00:00Z" />,
    );

    expect(html).toContain(label);
    expect(html).toContain(status);
    expect(html).toContain(row.fixture ?? "No future fixture");
    if (row.sourceHref) expect(html).toContain(`href="${row.sourceHref}"`);
  });

  it("sets route-specific metadata", () => {
    expect(metadata.alternates).toEqual({ canonical: "/value-lines/" });
    expect(metadata.description).toContain("1/X/2");
  });
});

describe("value-line checkout fail-closed controls", () => {
  it("requires checkout to start on a non-root path of the exact private service origin", () => {
    expect(validateValueLineCheckout(productionShapedOffer).invalidFields).not.toContain(
      "checkoutUrl",
    );
    expect(
      validateValueLineCheckout({
        ...productionShapedOffer,
        checkoutUrl: "https://buy.stripe.com/7sIaEW4vB8qL2mN5kR",
      }).invalidFields,
    ).toContain("checkoutUrl");
  });

  it.each([
    "https://members.punditbench.com/",
    "https://checkout.members.punditbench.com/start",
    "https://members.punditbench.com.evil.example/start",
    "http://members.punditbench.com/checkout/start",
    "https://buy.stripe.com/7sIaEW4vB8qL2mN5kR",
  ])("rejects a checkout start that can bypass the exact private service origin: %s", (checkoutUrl) => {
    const validation = validateValueLineCheckout({ ...productionShapedOffer, checkoutUrl });

    expect(validation.invalidFields).toContain("checkoutUrl");
  });

  it.each(["https://buy.stripe.com", "https://secure.punditbench.com"])(
    "rejects %s as a substitute private-service origin",
    (serviceBaseUrl) => {
      const validation = validateValueLineCheckout({
        ...productionShapedOffer,
        serviceBaseUrl,
        checkoutUrl: `${serviceBaseUrl}/checkout/start`,
        returnUrl: `${serviceBaseUrl}/checkout/complete`,
        cancelUrl: `${serviceBaseUrl}/checkout/cancelled`,
      });

      expect(validation.invalidFields).toContain("serviceBaseUrl");
      expect(validation.ready).toBe(false);
    },
  );

  it.each([
    "https://members.punditbench.com//",
    "https://members.punditbench.com/%2F",
    "https://members.punditbench.com/%252F",
  ])("rejects a checkout path that decodes to the service root: %s", (checkoutUrl) => {
    const validation = validateValueLineCheckout({ ...productionShapedOffer, checkoutUrl });

    expect(validation.invalidFields).toContain("checkoutUrl");
  });

  it.each([
    ["contactUrl", "https://punditbench.com/support/"],
    ["contactUrl", "https://PUNDITBENCH.com/contact/"],
    ["termsUrl", "https://punditbench.com/value-lines/privacy/"],
    ["privacyUrl", "https://www.punditbench.com/value-lines/privacy/"],
    ["refundsUrl", "https://punditbench.com/value-lines/refunds"],
    ["responsiblePlayUrl", "https://punditbench.com/value-lines/responsible-play/"],
  ] as const)("pins %s to its exact canonical PunditBench route", (field, value) => {
    const validation = validateValueLineCheckout({ ...productionShapedOffer, [field]: value });

    expect(validation.invalidFields).toContain(field);
  });

  it("rejects conflicting duplicate customer-page destinations", () => {
    const validation = validateValueLineCheckout({
      ...productionShapedOffer,
      privacyUrl: productionShapedOffer.termsUrl,
    });

    expect(validation.invalidFields).toContain("privacyUrl");
  });

  it("renders checkout only when every production control validates", () => {
    const html = renderToStaticMarkup(<ValueLineCheckoutCta offer={productionShapedOffer} />);

    expect(html).toContain(`href="${productionShapedOffer.checkoutUrl}"`);
    expect(html).toContain("Subscribe for €9/month");
    expect(html).toContain("recurring until cancelled");
    expect(html).toContain("Verified seller identity and geographic address");
    expect(html).toContain("Not betting advice.");
    expect(html).toContain(
      "18+ only. You must be resident in England, Scotland or Wales and must not be physically in Finland when purchasing or using Value Lines.",
    );
    expect(html.indexOf("18+ only.")).toBeLessThan(html.indexOf("Subscribe for €9/month"));
    expect(html).not.toContain("Checkout unavailable");
    expect(html).not.toContain("reviewed tax treatment");
    expect(html).not.toContain("cleared email delivery");
    expect(html).not.toContain(productionShapedOffer.sellerLegalName);
    expect(html).not.toContain(productionShapedOffer.sellerBusinessId);
    expect(html).not.toContain(productionShapedOffer.sellerAddressLine1);
  });

  it("renders each canonical customer-policy destination only once beside live checkout", () => {
    const html = renderToStaticMarkup(
      <>
        <ValueLineCheckoutCta offer={productionShapedOffer} />
        <ValueLinePolicyLinks />
      </>,
    );
    const normalizedPaths = Array.from(html.matchAll(/href="([^"]+)"/gu), ([, href]) =>
      new URL(href, "https://punditbench.com/").pathname.replace(/\/$/u, ""),
    );

    for (const path of [
      "/contact",
      "/value-lines/terms",
      "/value-lines/privacy",
      "/value-lines/refunds",
      "/responsible-play",
    ]) {
      expect(normalizedPaths.filter((candidate) => candidate === path)).toHaveLength(1);
    }
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

  it("does not require superseded review or policy-approval tokens", () => {
    expect(VALUE_LINE_REQUIRED_CONFIG_FIELDS).not.toContain("taxReviewed");
    expect(VALUE_LINE_REQUIRED_CONFIG_FIELDS).not.toContain("emailProviderClearance");
  });

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
    ["emailDomainVerified", "pending"],
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

  it.each(["TBD", "TBC", "N/A", "(TBD)", "TBC:", "[N/A]"])(
    "rejects the production placeholder marker %s",
    (marker) => {
      const validation = validateValueLineCheckout({
        ...productionShapedOffer,
        sellerLegalName: `Northern Metrics ${marker}`,
      });

      expect(validation.invalidFields).toContain("sellerLegalName");
    },
  );

  it.each([
    ["stripeAccountId", "acct_TBD12345678"],
    ["stripeProductId", "prod_TBC12345678"],
    ["stripePriceId", "price_TBD12345678"],
  ] as const)("rejects the placeholder marker in %s", (field, value) => {
    const validation = validateValueLineCheckout({ ...productionShapedOffer, [field]: value });

    expect(validation.invalidFields).toContain(field);
  });

  it.each([
    ["checkoutUrl", "https://buy.stripe.com/%54%42%44"],
    ["contactUrl", "https://punditbench.com/%54%42%43/contact/"],
    ["contactUrl", "https://punditbench.com/TBD/../contact/"],
    ["termsUrl", "https://punditbench.com/value-lines/%4E%2F%41/"],
    ["termsUrl", "https://punditbench.com/value-lines/%2554%2542%2544/"],
    ["refundsUrl", "https://punditbench.com/value-lines/%74%65%73%74/"],
    ["responsiblePlayUrl", "https://punditbench.com/value-lines/(TBD)/"],
    ["privacyUrl", "https://punditbench.com/value-lines/%E0%A4%A/"],
  ] as const)("rejects an encoded, normalized-away, or malformed production URL path in %s", (field, value) => {
    const validation = validateValueLineCheckout({ ...productionShapedOffer, [field]: value });

    expect(validation.invalidFields).toContain(field);
  });

  it.each([
    ["returnUrl", "https://punditbench.com/checkout/complete"],
    ["cancelUrl", "https://punditbench.com/checkout/cancelled"],
    ["returnUrl", "https://members.punditbench.com"],
    ["cancelUrl", "http://members.punditbench.com/checkout/cancelled"],
  ] as const)("rejects an unapproved callback in %s", (field, value) => {
    expect(validateValueLineCheckout({ ...productionShapedOffer, [field]: value }).ready).toBe(false);
  });

  it("rejects query strings and fragments on every configured public URL", () => {
    const urlFields = [
      "checkoutUrl",
      "contactUrl",
      "termsUrl",
      "privacyUrl",
      "refundsUrl",
      "responsiblePlayUrl",
      "serviceBaseUrl",
      "returnUrl",
      "cancelUrl",
    ] as const satisfies readonly (keyof ValueLineCheckoutInput)[];

    for (const field of urlFields) {
      for (const suffix of ["?", "#", "?customer=secret", "#customer-secret"]) {
        const validation = validateValueLineCheckout({
          ...productionShapedOffer,
          [field]: `${productionShapedOffer[field]}${suffix}`,
        });
        expect(validation.invalidFields).toContain(field);
      }
    }
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
    ["supportEmail", " support@punditbench.com"],
    ["supportEmail", "support?subject=help@punditbench.com"],
    ["supportEmail", "support#fragment@punditbench.com"],
    ["supportEmail", "support%0d%0a@punditbench.com"],
    ["supportEmail", "support@punditbench.com?bcc=attacker%40example.net"],
    ["emailSender", "issues?subject=help@updates.punditbench.com"],
    ["emailSender", "issues#fragment@updates.punditbench.com"],
    ["emailSender", "issues%250d%250a@updates.punditbench.com"],
  ] as const)("rejects unsafe URI syntax in %s=%s", (field, value) => {
    const validation = validateValueLineCheckout({ ...productionShapedOffer, [field]: value });

    expect(validation.invalidFields).toContain(field);
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
