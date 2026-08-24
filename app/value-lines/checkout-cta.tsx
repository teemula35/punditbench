import type { ValueLineCheckoutInput } from "@/lib/value-line-product";
import {
  VALUE_LINE_ELIGIBILITY_BOUNDARY,
  validateValueLineCheckout,
} from "@/lib/value-line-product";

export function VerifiedSellerNotice() {
  return (
    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
      Verified seller identity and geographic address are shown on the hosted checkout before
      payment.
    </p>
  );
}

export function ValueLineCheckoutCta({
  offer,
}: {
  offer: Partial<ValueLineCheckoutInput>;
}) {
  const validation = validateValueLineCheckout(offer);

  if (!validation.ready) {
    return (
      <section
        aria-labelledby="value-line-checkout-title"
        className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/80 shadow-2xl shadow-black/20"
      >
        <div className="border-b border-zinc-800 bg-zinc-950/60 px-5 py-4 sm:px-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Checkout unavailable
          </p>
          <h2 id="value-line-checkout-title" className="mt-1 text-xl font-bold text-zinc-50">
            Subscription activation is still closed
          </h2>
        </div>
        <div className="p-5 sm:p-7">
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
            Checkout stays disabled until the seller identity and address, exact recurring Stripe
            price, working return paths, verified email delivery, live customer pages, subscriber
            service and explicit live activation all validate together.
          </p>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-5 inline-flex cursor-not-allowed items-center rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-3 text-sm font-semibold text-zinc-500"
          >
            Checkout unavailable
          </button>
          <p className="mt-4 text-xs font-semibold text-zinc-300">Not betting advice.</p>
        </div>
      </section>
    );
  }

  const configured = offer as ValueLineCheckoutInput;
  return (
    <section
      aria-labelledby="value-line-checkout-title"
      className="overflow-hidden rounded-2xl border border-emerald-400/35 bg-emerald-400/[0.06] shadow-2xl shadow-emerald-950/20"
    >
      <div className="border-b border-emerald-400/15 bg-zinc-950/50 px-5 py-4 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          Monthly access
        </p>
        <h2 id="value-line-checkout-title" className="mt-1 text-xl font-bold text-zinc-50">
          €9/month, recurring until cancelled
        </h2>
      </div>
      <div className="p-5 sm:p-7">
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-300">
          {configured.taxNotice}. {configured.deliveryMethod}. Cancel any time; access continues
          through the end of the paid billing period.
        </p>
        <VerifiedSellerNotice />
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">Support: {configured.supportEmail}.</p>
        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-zinc-300">
          {VALUE_LINE_ELIGIBILITY_BOUNDARY}
        </p>
        <a
          href={configured.checkoutUrl}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-400 px-5 py-3 text-sm font-bold text-zinc-950 transition-colors hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          Subscribe for €9/month
        </a>
        <p className="mt-4 text-xs font-semibold text-zinc-200">Not betting advice.</p>
      </div>
    </section>
  );
}
