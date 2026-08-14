import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BriefRefundsPage from "../app/briefs/opening-round-2026/refunds/page";
import BriefPrivacyPage from "../app/briefs/opening-round-2026/privacy/page";

const SELLER = {
  PB_BRIEF_SELLER_NAME: "Example Seller Oy",
  PB_BRIEF_SELLER_ADDRESS: "Example Street 1, 00100 Helsinki, Finland",
  PB_BRIEF_SELLER_ID: "1234567-8",
  PB_BRIEF_SUPPORT_EMAIL: "support@example.com",
};

function withSellerEnv<T>(run: () => T): T {
  for (const [name, value] of Object.entries(SELLER)) vi.stubEnv(name, value);
  try {
    return run();
  } finally {
    vi.unstubAllEnvs();
  }
}

describe("brief refunds and withdrawal page", () => {
  it("states the pre-delivery cancellation right, the non-delivery refund and the seller", () => {
    const html = withSellerEnv(() => renderToStaticMarkup(<BriefRefundsPage />));

    expect(html).toContain("Cancel any time before delivery");
    expect(html).toContain("14-day right of withdrawal");
    expect(html).toContain("3 September 2026");
    expect(html).toContain("refunded in full");
    expect(html).toContain("original payment method");
    expect(html).toContain("Example Seller Oy");
    expect(html).toContain("Business ID 1234567-8");
    expect(html).toContain("support@example.com");
  });

  it("renders safely without seller configuration", () => {
    const html = renderToStaticMarkup(<BriefRefundsPage />);

    expect(html).toContain("Cancel any time before delivery");
    expect(html).toContain("shown at checkout");
    expect(html).not.toContain("Business ID");
  });
});

describe("brief purchase privacy page", () => {
  it("names the controller, Stripe, retention and the buyer's rights", () => {
    const html = withSellerEnv(() => renderToStaticMarkup(<BriefPrivacyPage />));

    expect(html).toContain("Controller");
    expect(html).toContain("Example Seller Oy");
    expect(html).toContain("stripe.com/privacy");
    expect(html).toContain("Finnish bookkeeping law");
    expect(html).toContain("added to any marketing list");
    expect(html).toContain("tietosuoja.fi");
  });

  it("renders safely without seller configuration", () => {
    const html = renderToStaticMarkup(<BriefPrivacyPage />);

    expect(html).toContain("identified at checkout");
    expect(html).toContain("stripe.com/privacy");
  });
});
