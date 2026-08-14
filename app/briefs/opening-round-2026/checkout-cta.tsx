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

function isHttpsUrl(value: string | undefined, hostname?: string, requirePath = false): value is string {
  if (!value) return false;
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

const text = (value: string | undefined): string | null =>
  value && value.trim() ? value.trim() : null;

/**
 * The payment link alone gates the buy button. Seller, VAT and policy
 * details render when supplied and are silently omitted when absent or
 * invalid. The delivery deadline and the full-refund-on-non-delivery
 * remedy are unconditional commitments and render on every armed checkout.
 */
export function hasValidCheckoutUrl(offer: Partial<OpeningRoundOfferInput>): boolean {
  return isHttpsUrl(offer.checkoutUrl, "buy.stripe.com", true);
}

export function CheckoutCta({ offer }: { offer: Partial<OpeningRoundOfferInput> }) {
  if (!hasValidCheckoutUrl(offer)) {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-lg font-semibold text-zinc-100">Checkout is not open yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          The payment link is not configured in this build. The complete sample above stays free
          either way.
        </p>
      </section>
    );
  }

  const sellerName = text(offer.sellerName);
  const sellerAddress = text(offer.sellerAddress);
  const supportEmailRaw = text(offer.supportEmail);
  const supportEmail =
    supportEmailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmailRaw) ? supportEmailRaw : null;
  const vatNotice = text(offer.vatNotice);
  const deliveryMethod = text(offer.deliveryMethod);
  const policyLinkCandidates: [string, string | undefined][] = [
    ["Terms", offer.termsUrl],
    ["Privacy", offer.privacyUrl],
    ["Refunds and withdrawal", offer.refundsUrl],
  ];
  const policyLinks = policyLinkCandidates.filter((entry): entry is [string, string] =>
    isHttpsUrl(entry[1]),
  );

  return (
    <section className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-5">
      <h2 className="text-lg font-semibold text-zinc-100">€5 once. No subscription.</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">
        Total price: €5{vatNotice ? `, ${vatNotice}` : ""}. Delivered by email by 3 September 2026
        at 23:59 UTC{deliveryMethod ? ` — ${deliveryMethod}` : ""}. If the issue is not delivered
        by then, you get a full refund.
      </p>
      {sellerName && sellerAddress && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Sold by {sellerName}, {sellerAddress}.
        </p>
      )}
      {supportEmail && (
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Questions or complaints:{" "}
          <a className="text-emerald-400 hover:underline" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
          .
        </p>
      )}
      {policyLinks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {policyLinks.map(([label, url]) => (
            <a key={label} className="text-emerald-400 hover:underline" href={url}>
              {label}
            </a>
          ))}
        </div>
      )}
      <a
        className="mt-5 inline-flex rounded-md bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-300"
        href={offer.checkoutUrl}
      >
        Buy the brief for €5
      </a>
    </section>
  );
}
