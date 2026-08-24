import {
  verifyClosedOfferHtml,
  verifyLiveOfferHtml,
  type ClosedOfferVerification,
  type LiveOfferVerification,
} from "./opening-round-offer-export";

const VALUE_LINE_CHECKOUT_LABEL = "Subscribe for €9/month";
const VALUE_LINE_CLOSED_FALLBACK = "Checkout unavailable";

export type ValueLineOfferVerification = LiveOfferVerification;
export type ClosedValueLineOfferVerification = ClosedOfferVerification;

export function verifyValueLineOfferHtml(
  html: string,
  checkoutUrl: string,
): ValueLineOfferVerification {
  return verifyLiveOfferHtml(
    html,
    checkoutUrl,
    VALUE_LINE_CHECKOUT_LABEL,
    VALUE_LINE_CLOSED_FALLBACK,
    { fallbackMustBeAvailable: false },
  );
}

export function verifyClosedValueLineOfferHtml(
  html: string,
): ClosedValueLineOfferVerification {
  return verifyClosedOfferHtml(
    html,
    VALUE_LINE_CHECKOUT_LABEL,
    VALUE_LINE_CLOSED_FALLBACK,
    "buy.stripe.com",
  );
}
