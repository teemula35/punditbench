import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import ContactPage from "../app/contact/page";
import ResponsiblePlayPage from "../app/responsible-play/page";
import ValueLinePolicyLinks from "../app/value-lines/policy-links";
import ValueLinePrivacyPage from "../app/value-lines/privacy/page";
import ValueLineRefundsPage from "../app/value-lines/refunds/page";
import ValueLineTermsPage from "../app/value-lines/terms/page";

const commercialEnvironment = {
  PB_VALUE_LINES_SELLER_LEGAL_NAME: "Northern Metrics Oy",
  PB_VALUE_LINES_SELLER_BUSINESS_ID: "1234567-8",
  PB_VALUE_LINES_SELLER_ADDRESS_LINE_1: "42 Market Street",
  PB_VALUE_LINES_SELLER_POSTAL_CODE: "00100",
  PB_VALUE_LINES_SELLER_CITY: "Helsinki",
  PB_VALUE_LINES_SELLER_COUNTRY_CODE: "FI",
  PB_VALUE_LINES_SUPPORT_EMAIL: "support@punditbench.com",
  PB_VALUE_LINES_EMAIL_PROVIDER: "Resend",
} as const;

const originalEnvironment = Object.fromEntries(
  Object.keys(commercialEnvironment).map((key) => [key, process.env[key]]),
);

function withCommercialEnvironment<T>(fn: () => T): T {
  Object.assign(process.env, commercialEnvironment);
  return fn();
}

function withoutCommercialEnvironment<T>(fn: () => T): T {
  for (const key of Object.keys(commercialEnvironment)) delete process.env[key];
  return fn();
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Value Lines customer pages", () => {
  it("states the exact subscription, eligibility, cancellation and product boundaries", () => {
    const html = withCommercialEnvironment(() => renderToStaticMarkup(<ValueLineTermsPage />));

    expect(html).toContain("€9 per month");
    expect(html).toContain(
      "18+ only. You must be resident in England, Scotland or Wales and must not be physically in Finland when purchasing or using Value Lines.",
    );
    expect(html).toContain("cancel at any time");
    expect(html).toContain("five named leagues");
    expect(html).toContain("at least 60 minutes before that issue&#x27;s first kickoff");
    expect(html).toContain("delivery starts with the next eligible issue");
    expect(html).toContain("Not betting advice.");
    expect(html).toContain("Northern Metrics Oy");
    expect(html).toContain("1234567-8");
  });

  it("documents the subscription data flow without enrolling buyers into marketing", () => {
    const html = withCommercialEnvironment(() => renderToStaticMarkup(<ValueLinePrivacyPage />));

    expect(html).toContain("Controller");
    expect(html).toContain("Northern Metrics Oy");
    expect(html).toContain("Stripe");
    expect(html).toContain("Resend");
    expect(html).toContain("not added to a marketing list");
    expect(html).toContain("access, correction or deletion");
    expect(html).toContain("does not ask you to provide health data during checkout or delivery");
    expect(html).toContain("do not include health data in support messages");
    expect(html).toContain('href="https://tietosuoja.fi/"');
  });

  it("states cancellation, failed-delivery and refund handling without waiving statutory rights", () => {
    const html = withCommercialEnvironment(() => renderToStaticMarkup(<ValueLineRefundsPage />));

    expect(html).toContain("cancel at any time");
    expect(html).toContain("paid billing period");
    expect(html).toContain("failed or materially misdescribed");
    expect(html).toContain("original payment method");
    expect(html).toContain("statutory rights");
    expect(html).not.toContain("was failed");
  });

  it("publishes the product safety boundary and independent support routes", () => {
    const html = renderToStaticMarkup(<ResponsiblePlayPage />);

    expect(html).toContain("18+");
    expect(html).toContain(
      "18+ only. You must be resident in England, Scotland or Wales and must not be physically in Finland when purchasing or using Value Lines.",
    );
    expect(html).toContain("Not betting advice.");
    expect(html).toContain("staking or bankroll instructions");
    expect(html).toContain("https://www.gamcare.org.uk/");
    expect(html).toContain("https://www.gambleaware.org/");
    expect(html.match(/href="\/contact"/g)).toHaveLength(1);
  });

  it("publishes the configured seller and support destination", () => {
    const html = withCommercialEnvironment(() => renderToStaticMarkup(<ContactPage />));

    expect(html).toContain("Northern Metrics Oy");
    expect(html).toContain("42 Market Street");
    expect(html).toContain("support@punditbench.com");
    expect(html).toContain('href="mailto:support@punditbench.com"');
    expect(html).toContain("Value Lines contact and seller details");
    expect(html).toContain("Value Lines checkout");
  });

  it("fails closed on seller/contact details when commercial configuration is absent", () => {
    const html = withoutCommercialEnvironment(() => renderToStaticMarkup(<ContactPage />));

    expect(html).toContain("shown at Stripe Checkout and on the receipt");
    expect(html).not.toContain("mailto:");
  });

  it.each([
    ["PB_VALUE_LINES_SELLER_LEGAL_NAME", "Example Seller Oy"],
    ["PB_VALUE_LINES_SELLER_BUSINESS_ID", "TBD"],
    ["PB_VALUE_LINES_SELLER_ADDRESS_LINE_1", "Placeholder Street"],
    ["PB_VALUE_LINES_SELLER_POSTAL_CODE", "N/A"],
    ["PB_VALUE_LINES_SELLER_CITY", "Test City"],
    ["PB_VALUE_LINES_SELLER_COUNTRY_CODE", "Finland"],
    ["PB_VALUE_LINES_SUPPORT_EMAIL", "support@punditbench.com?subject=help"],
  ] as const)("renders no partial seller identity when %s is invalid", (key, value) => {
    const html = withCommercialEnvironment(() => {
      process.env[key] = value;
      return renderToStaticMarkup(<ContactPage />);
    });

    expect(html).toContain("shown at Stripe Checkout and on the receipt");
    expect(html).not.toContain("Northern Metrics Oy");
    expect(html).not.toContain("1234567-8");
    expect(html).not.toContain("mailto:");
  });

  it("renders no partial controller identity when the seller record is incomplete", () => {
    const html = withCommercialEnvironment(() => {
      delete process.env.PB_VALUE_LINES_SELLER_ADDRESS_LINE_1;
      return renderToStaticMarkup(<ValueLinePrivacyPage />);
    });

    expect(html).toContain("shown at Stripe Checkout and on the receipt");
    expect(html).not.toContain("Northern Metrics Oy");
    expect(html).not.toContain("mailto:");
  });

  it.each([
    " support@punditbench.com",
    "support?subject=help@punditbench.com",
    "support#fragment@punditbench.com",
    "support%0d%0a@punditbench.com",
    "support@punditbench.com?bcc=attacker%40example.net",
  ])("never renders an unsafe support address as a mailto URI: %s", (supportEmail) => {
    const html = withCommercialEnvironment(() => {
      process.env.PB_VALUE_LINES_SUPPORT_EMAIL = supportEmail;
      return renderToStaticMarkup(<ContactPage />);
    });

    expect(html).toContain("shown at Stripe Checkout and on the receipt");
    expect(html).not.toContain("mailto:");
  });

  it("links every customer page from the Value Lines surface", () => {
    const html = renderToStaticMarkup(<ValueLinePolicyLinks />);

    expect(html).toContain('href="/value-lines/terms"');
    expect(html).toContain('href="/value-lines/privacy"');
    expect(html).toContain('href="/value-lines/refunds"');
    expect(html).toContain('href="/responsible-play"');
    expect(html).toContain('href="/contact"');
  });
});
