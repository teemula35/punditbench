import type { Metadata } from "next";
import ValueLinePolicyLinks from "../value-lines/policy-links";
import {
  CustomerPage,
  Paragraph,
  SectionTitle,
  SellerDetails,
  valueLineSeller,
} from "../value-lines/customer-page";

export const metadata: Metadata = {
  title: "Value Lines contact",
  description: "Seller and support details for the PunditBench Value Lines subscription.",
  alternates: { canonical: "/contact/" },
};

export default function ContactPage() {
  const seller = valueLineSeller();

  return (
    <CustomerPage
      title="Value Lines contact and seller details"
      description="Use the same email address that you used at Value Lines checkout when asking about a payment, delivery or cancellation."
    >
      <SectionTitle>Seller</SectionTitle>
      <SellerDetails />

      <SectionTitle>Support and complaints</SectionTitle>
      {seller.supportEmail ? (
        <Paragraph>
          Email{" "}
          <a className="text-emerald-400 underline underline-offset-2" href={`mailto:${seller.supportEmail}`}>
            {seller.supportEmail}
          </a>
          . Include the Stripe receipt ID, but never send card details or passwords.
        </Paragraph>
      ) : (
        <Paragraph>
          The live support destination is shown at Stripe Checkout and on the receipt. Checkout
          remains disabled until it is configured.
        </Paragraph>
      )}
      <ValueLinePolicyLinks />
    </CustomerPage>
  );
}
