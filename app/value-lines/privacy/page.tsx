import type { Metadata } from "next";
import ValueLinePolicyLinks from "../policy-links";
import {
  CustomerPage,
  LINK_CLASS,
  Paragraph,
  SectionTitle,
  SellerDetails,
  valueLineSeller,
} from "../customer-page";

export const metadata: Metadata = {
  title: "Value Lines privacy notice",
  description: "How subscriber, payment, eligibility and delivery data is handled for Value Lines.",
  alternates: { canonical: "/value-lines/privacy/" },
};

export default function ValueLinePrivacyPage() {
  const seller = valueLineSeller();

  return (
    <CustomerPage
      title="Privacy notice"
      description="This notice covers personal data handled for the Value Lines subscription."
    >
      <SectionTitle>Controller</SectionTitle>
      <SellerDetails />

      <SectionTitle>Data and purposes</SectionTitle>
      <Paragraph>
        The service processes your email address, Stripe customer and subscription identifiers,
        payment and entitlement status, age and territory declarations, delivery attempts,
        cancellation events and support messages. These records are used to create and administer
        the subscription, enforce eligibility, deliver issues, prevent duplicate delivery, handle
        support and refunds, and meet accounting obligations.
      </Paragraph>

      <SectionTitle>Processors</SectionTitle>
      <Paragraph>
        Stripe processes checkout and card details under its own privacy notice. The configured
        delivery provider{seller.emailProvider ? ` is ${seller.emailProvider}` : " is identified in your delivery email"}.
        Card details never enter PunditBench systems. Service providers receive only the data needed
        for payment, delivery and operational security.
      </Paragraph>

      <SectionTitle>No marketing enrolment</SectionTitle>
      <Paragraph>
        A purchase email is used for this subscription and support. It is not added to a marketing
        list, sold, or used to build a betting profile. Value Lines does not collect betting history,
        stakes, losses or affordability information, and does not ask you to provide health data
        during checkout or delivery. Please do not include health data in support messages.
      </Paragraph>

      <SectionTitle>Retention and rights</SectionTitle>
      <Paragraph>
        Transaction records are retained for the period required by applicable accounting rules.
        Delivery, entitlement and support records are retained only while needed to operate the
        subscription, resolve disputes and prevent replay or duplicate delivery. Contact support to
        request access, correction or deletion, subject to required record-keeping, or to object to
        processing. You may complain to the Finnish Data Protection Ombudsman at{" "}
        <a className={LINK_CLASS} href="https://tietosuoja.fi/">
          tietosuoja.fi
        </a>
        .
      </Paragraph>
      <ValueLinePolicyLinks />
    </CustomerPage>
  );
}
