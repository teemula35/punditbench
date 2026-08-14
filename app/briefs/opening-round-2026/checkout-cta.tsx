import React from "react";

export interface OpeningRoundOfferInput {
  checkoutUrl: string;
  sellerName: string;
  sellerAddress: string;
  supportEmail: string;
  vatNotice: string;
  deliveryMethod: string;
  termsUrl: string;
  privacyUrl: string;
  refundsUrl: string;
}

const REQUIRED_FIELDS: (keyof OpeningRoundOfferInput)[] = [
  "checkoutUrl",
  "sellerName",
  "sellerAddress",
  "supportEmail",
  "vatNotice",
  "deliveryMethod",
  "termsUrl",
  "privacyUrl",
  "refundsUrl",
];

function isHttpsUrl(value: string, hostname?: string, requirePath = false): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (!hostname || url.hostname === hostname) &&
      (!requirePath || url.pathname.length > 1)
    );
  } catch {
    return false;
  }
}

export function isReadyOpeningRoundOffer(
  offer: Partial<OpeningRoundOfferInput>,
): offer is OpeningRoundOfferInput {
  if (!REQUIRED_FIELDS.every((field) => typeof offer[field] === "string" && offer[field]!.trim())) {
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(offer.supportEmail!)) return false;
  if (!isHttpsUrl(offer.checkoutUrl!, "buy.stripe.com", true)) return false;
  return [offer.termsUrl!, offer.privacyUrl!, offer.refundsUrl!].every((url) => isHttpsUrl(url));
}

export function CheckoutCta({ offer }: { offer: Partial<OpeningRoundOfferInput> }) {
  const complete = isReadyOpeningRoundOffer(offer);

  if (!complete) {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-lg font-semibold text-zinc-100">Checkout is not open yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Checkout stays closed until the seller, consumer and refund details are approved and the
          payment and delivery path has passed a test transaction.
        </p>
      </section>
    );
  }

  const ready = offer as OpeningRoundOfferInput;
  return (
    <section className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-5">
      <h2 className="text-lg font-semibold text-zinc-100">€5 once. No subscription.</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">
        Total consumer price: €5, {ready.vatNotice}. Delivery by 3 September 2026 at 23:59 UTC.
        {" "}{ready.deliveryMethod}.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        Sold by {ready.sellerName}, {ready.sellerAddress}. Questions or complaints:{" "}
        <a className="text-emerald-400 hover:underline" href={`mailto:${ready.supportEmail}`}>
          {ready.supportEmail}
        </a>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <a className="text-emerald-400 hover:underline" href={ready.termsUrl}>Terms</a>
        <a className="text-emerald-400 hover:underline" href={ready.privacyUrl}>Privacy</a>
        <a className="text-emerald-400 hover:underline" href={ready.refundsUrl}>Refunds and withdrawal</a>
      </div>
      <a
        className="mt-5 inline-flex rounded-md bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-300"
        href={ready.checkoutUrl}
      >
        Buy the brief for €5
      </a>
    </section>
  );
}
