import type { Metadata } from "next";
import { VALUE_LINE_ELIGIBILITY_BOUNDARY } from "@/lib/value-line-product";
import ValueLinePolicyLinks from "../policy-links";
import { CustomerPage, Paragraph, SectionTitle, SellerDetails } from "../customer-page";

export const metadata: Metadata = {
  title: "Value Lines subscription terms",
  description: "Price, eligibility, delivery and cancellation terms for Value Lines.",
  alternates: { canonical: "/value-lines/terms/" },
};

export default function ValueLineTermsPage() {
  return (
    <CustomerPage
      title="Subscription terms"
      description="These terms describe the recurring PunditBench Value Lines subscription."
    >
      <SectionTitle>Product and price</SectionTitle>
      <Paragraph>
        Value Lines costs exactly €9 per month and renews monthly until cancelled. It delivers
        deterministic pre-match research cards by email for eligible fixtures in the five named
        leagues: Premier League, La Liga, Serie A, Bundesliga and Ligue 1. The underlying locked
        PunditBench forecasts and public benchmark stay free.
      </Paragraph>

      <SectionTitle>Eligibility</SectionTitle>
      <Paragraph>
        {VALUE_LINE_ELIGIBILITY_BOUNDARY} Northern Ireland and every other territory are excluded. Do
        not subscribe for another person.
      </Paragraph>

      <SectionTitle>What the cards are</SectionTitle>
      <Paragraph>
        Cards transform already locked public model forecasts into counts, calibrated probabilities
        and reference-price thresholds. They do not use bookmaker feeds, execute wagers, recommend
        stakes or promise returns. Not betting advice.
      </Paragraph>

      <SectionTitle>Delivery and cancellation</SectionTitle>
      <Paragraph>
        Issues are sent before eligible fixtures when the source round is locked and at least 20
        valid model forecasts are available. To receive an issue, complete checkout at least 60
        minutes before that issue&apos;s first kickoff. If checkout is completed after the cutoff,
        delivery starts with the next eligible issue. You may cancel at any time. Cancellation
        prevents the next renewal while access continues through the current paid billing period.
      </Paragraph>

      <SectionTitle>Seller and support</SectionTitle>
      <SellerDetails />
      <ValueLinePolicyLinks />
    </CustomerPage>
  );
}
