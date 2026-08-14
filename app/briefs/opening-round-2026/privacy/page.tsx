import React from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy notice — brief purchases",
  description:
    "How purchase data is handled for the one-off €5 five-league opening-round brief.",
  alternates: { canonical: "/briefs/opening-round-2026/privacy/" },
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

export default function BriefPrivacyPage() {
  const s = seller();

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
        Five-league opening-round brief
      </p>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
        Privacy notice for brief purchases
      </h1>
      <P>
        This notice covers personal data handled when you buy the Five-League Opening-Round Brief.
        Ordinary browsing of PunditBench is covered separately by the site&apos;s analytics consent
        banner.
      </P>

      <H>Controller</H>
      <P>
        {s.name ? (
          <>
            {s.name}
            {s.businessId ? ` (Business ID ${s.businessId})` : ""}
            {s.address ? `, ${s.address}` : ""}. Contact: {s.email ?? "see the offer page"}.
          </>
        ) : (
          <>The seller identified at checkout and on your receipt. Contact details are shown there.</>
        )}
      </P>

      <H>What is processed, and why</H>
      <P>
        The email address you enter at checkout, your name if you provide one, and transaction
        details (what you bought, when, amount, payment status). This is used to deliver the brief
        you purchased, to handle cancellations and refunds, and to keep the transaction records
        required by Finnish bookkeeping law. The legal bases are the performance of your purchase
        contract and compliance with legal obligations.
      </P>

      <H>Payment processing</H>
      <P>
        Payments run entirely on Stripe. Your card details go to Stripe, never to us — we receive
        only confirmation of payment and the details above. Stripe processes data under its own
        privacy policy at stripe.com/privacy.
      </P>

      <H>What is not done with your data</H>
      <P>
        Purchase emails are used for delivering and supporting this purchase only. They are not
        added to any marketing list, not shared beyond the processors named here, and not sold.
      </P>

      <H>Retention</H>
      <P>
        Transaction records are kept as long as Finnish bookkeeping law requires. The delivery
        email list is deleted once it is no longer needed for delivery, refunds or support.
      </P>

      <H>Your rights</H>
      <P>
        You can ask for access to, correction of, or deletion of your data (deletion within the
        limits of statutory record-keeping), and object to processing, by contacting{" "}
        {s.email ?? "the support address shown at checkout"}. You may also lodge a complaint with
        the Finnish Data Protection Ombudsman (tietosuoja.fi).
      </P>

      <p className="mt-8 text-sm">
        <Link className="text-emerald-400 hover:underline" href="/briefs/opening-round-2026/">
          ← Back to the brief
        </Link>
      </p>
    </div>
  );
}
