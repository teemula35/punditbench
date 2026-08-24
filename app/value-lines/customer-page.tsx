import React from "react";
import Link from "next/link";
import { validatedValueLineSellerIdentity } from "@/lib/value-line-product";

const LINK_CLASS =
  "text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-400";

function configured(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function valueLineSeller() {
  const identity = validatedValueLineSellerIdentity({
    sellerLegalName: configured("PB_VALUE_LINES_SELLER_LEGAL_NAME") ?? undefined,
    sellerBusinessId: configured("PB_VALUE_LINES_SELLER_BUSINESS_ID") ?? undefined,
    sellerAddressLine1: configured("PB_VALUE_LINES_SELLER_ADDRESS_LINE_1") ?? undefined,
    sellerPostalCode: configured("PB_VALUE_LINES_SELLER_POSTAL_CODE") ?? undefined,
    sellerCity: configured("PB_VALUE_LINES_SELLER_CITY") ?? undefined,
    sellerCountryCode: configured("PB_VALUE_LINES_SELLER_COUNTRY_CODE") ?? undefined,
    supportEmail: process.env.PB_VALUE_LINES_SUPPORT_EMAIL,
  });
  return {
    name: identity?.sellerLegalName ?? null,
    businessId: identity?.sellerBusinessId ?? null,
    addressLine1: identity?.sellerAddressLine1 ?? null,
    postalCode: identity?.sellerPostalCode ?? null,
    city: identity?.sellerCity ?? null,
    countryCode: identity?.sellerCountryCode ?? null,
    supportEmail: identity?.supportEmail ?? null,
    emailProvider: configured("PB_VALUE_LINES_EMAIL_PROVIDER"),
  };
}

export function CustomerPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
        Value Lines
      </p>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-300">{description}</p>
      {children}
      <p className="mt-8 text-sm">
        <Link className={LINK_CLASS} href="/value-lines/">
          ← Back to Value Lines
        </Link>
      </p>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-lg font-semibold text-zinc-100">{children}</h2>;
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-zinc-300">{children}</p>;
}

export function SellerDetails() {
  const seller = valueLineSeller();
  if (!seller.name) {
    return (
      <Paragraph>
        The contracting seller, geographical address, Business ID and support destination are shown
        at Stripe Checkout and on the receipt.
      </Paragraph>
    );
  }

  const address = [
    seller.addressLine1,
    [seller.postalCode, seller.city].filter(Boolean).join(" "),
    seller.countryCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Paragraph>
      {seller.name}
      {seller.businessId ? ` (Business ID ${seller.businessId})` : ""}
      {address ? `, ${address}` : ""}.
      {seller.supportEmail ? (
        <>
          {" "}Support: <a className={LINK_CLASS} href={`mailto:${seller.supportEmail}`}>{seller.supportEmail}</a>.
        </>
      ) : null}
    </Paragraph>
  );
}

export { LINK_CLASS };
