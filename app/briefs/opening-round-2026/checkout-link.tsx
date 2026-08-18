"use client";

import React, { type AnchorHTMLAttributes } from "react";

export type AnalyticsEventReporter = (
  command: "event",
  eventName: string,
  params?: Record<string, unknown>,
) => void;

function activeAnalyticsReporter(): AnalyticsEventReporter | undefined {
  if (typeof window === "undefined") return undefined;
  return window.gtag;
}

/**
 * Records a checkout start only when consent-gated analytics is already loaded.
 * `window.gtag` does not exist before consent, so declining or ignoring the
 * banner leaves the click entirely unmeasured.
 */
export function trackCheckoutStart(
  report: AnalyticsEventReporter | undefined = activeAnalyticsReporter(),
): void {
  report?.("event", "begin_checkout", {
    currency: "EUR",
    value: 5,
    items: [
      {
        item_id: "opening_round_2026",
        item_name: "Five-League Opening-Round Brief",
        price: 5,
        quantity: 1,
      },
    ],
    transport_type: "beacon",
  });
}

type CheckoutLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> & {
  href: string;
};

export function CheckoutLink({ children, ...props }: CheckoutLinkProps) {
  return (
    <a
      {...props}
      data-analytics-event="begin_checkout"
      onClick={() => trackCheckoutStart()}
    >
      {children}
    </a>
  );
}
