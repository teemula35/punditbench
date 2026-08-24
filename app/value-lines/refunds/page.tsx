import type { Metadata } from "next";
import ValueLinePolicyLinks from "../policy-links";
import { CustomerPage, Paragraph, SectionTitle, SellerDetails } from "../customer-page";

export const metadata: Metadata = {
  title: "Value Lines cancellation and refunds",
  description: "Cancellation, failed-delivery and refund handling for Value Lines.",
  alternates: { canonical: "/value-lines/refunds/" },
};

export default function ValueLineRefundsPage() {
  return (
    <CustomerPage
      title="Cancellation and refunds"
      description="These rules apply to the recurring €9 monthly Value Lines subscription."
    >
      <SectionTitle>Cancel any time</SectionTitle>
      <Paragraph>
        You may cancel at any time through the subscriber service or by contacting support.
        Cancellation stops the next renewal. Access continues through the current paid billing
        period, and no new charge is made after cancellation takes effect.
      </Paragraph>

      <SectionTitle>Failed or faulty delivery</SectionTitle>
      <Paragraph>
        Contact support if a paid issue was not delivered, was duplicated, failed or
        materially misdescribed. The seller will restore delivery, correct the issue where possible,
        or refund the affected charge. Nothing on this page limits your statutory rights.
      </Paragraph>

      <SectionTitle>Payment failures and disputes</SectionTitle>
      <Paragraph>
        A failed or disputed payment suspends new delivery conservatively; it does not create a
        second subscription or retry delivery as a duplicate. Approved refunds are returned through
        Stripe to the original payment method. No refund fee is deducted by PunditBench.
      </Paragraph>

      <SectionTitle>Seller and contact</SectionTitle>
      <SellerDetails />
      <ValueLinePolicyLinks />
    </CustomerPage>
  );
}
