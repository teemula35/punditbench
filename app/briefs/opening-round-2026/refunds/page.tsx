import React from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refunds and withdrawal — Five-league opening-round brief",
  description:
    "Cancellation, withdrawal and refund terms for the one-off €5 five-league opening-round brief.",
  alternates: { canonical: "/briefs/opening-round-2026/refunds/" },
};

function seller() {
  return {
    name: process.env.PB_BRIEF_SELLER_NAME?.trim() || null,
    address: process.env.PB_BRIEF_SELLER_ADDRESS?.trim() || null,
    businessId: process.env.PB_BRIEF_SELLER_ID?.trim() || null,
    email: process.env.PB_BRIEF_SUPPORT_EMAIL?.trim() || null,
  };
}

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-8 text-lg font-semibold text-zinc-100">{children}</h2>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 text-sm leading-relaxed text-zinc-300">{children}</p>
);

export default function BriefRefundsPage() {
  const s = seller();

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
        Five-league opening-round brief
      </p>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Refunds and withdrawal</h1>
      <P>
        These terms apply to the one-time €5 purchase of the PunditBench Five-League Opening-Round
        Brief, a digital report delivered by email by 3 September 2026 at 23:59 UTC. Nothing here
        limits your statutory rights under Finnish and EU consumer law.
      </P>

      <H>Cancel any time before delivery</H>
      <P>
        You may cancel your purchase at any time before the brief is delivered, for any reason or
        none, and receive a full refund. Email {s.email ? <strong>{s.email}</strong> : "the support address shown at checkout"} from
        the address you used at checkout. This includes, and is broader than, the 14-day right of
        withdrawal that applies to distance purchases in the EU.
      </P>

      <H>If the brief is not delivered on time</H>
      <P>
        If the brief has not been delivered to your checkout email by 3 September 2026 at 23:59
        UTC, you will be refunded in full. You do not need to ask.
      </P>

      <H>After delivery</H>
      <P>
        Delivery of the brief completes the purchase. Your statutory rights regarding faulty or
        misdescribed digital content remain unaffected — if the delivered issue is materially not
        what was described on the offer page, contact support and it will be put right or
        refunded.
      </P>

      <H>How refunds are paid</H>
      <P>
        Refunds go back to the original payment method through Stripe, normally within 14 days of
        the request. No fees are deducted.
      </P>

      <H>Seller and contact</H>
      <P>
        {s.name ? (
          <>
            Sold by {s.name}
            {s.businessId ? ` (Business ID ${s.businessId})` : ""}
            {s.address ? `, ${s.address}` : ""}. Questions and complaints: {s.email ?? "see the offer page"}.
          </>
        ) : (
          <>Seller and contact details are shown at checkout and on your receipt.</>
        )}
      </P>

      <p className="mt-8 text-sm">
        <Link className="text-emerald-400 hover:underline" href="/briefs/opening-round-2026/">
          ← Back to the brief
        </Link>
      </p>
    </div>
  );
}
