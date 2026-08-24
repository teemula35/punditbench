import type { Metadata } from "next";
import { VALUE_LINE_ELIGIBILITY_BOUNDARY } from "@/lib/value-line-product";
import ValueLinePolicyLinks from "../value-lines/policy-links";
import { CustomerPage, LINK_CLASS, Paragraph, SectionTitle } from "../value-lines/customer-page";

export const metadata: Metadata = {
  title: "Responsible play",
  description: "The safety boundary for PunditBench Value Lines.",
  alternates: { canonical: "/responsible-play/" },
};

export default function ResponsiblePlayPage() {
  return (
    <CustomerPage
      title="Responsible play"
      description="Value Lines is restricted to eligible adults and is not a wagering service."
    >
      <SectionTitle>18+ only</SectionTitle>
      <Paragraph>
        {VALUE_LINE_ELIGIBILITY_BOUNDARY} Do not buy or share it for a minor or an excluded person.
      </Paragraph>

      <SectionTitle>Product boundary</SectionTitle>
      <Paragraph>
        Not betting advice. Value Lines provides no bookmaker links, affiliate offers, wager
        execution, personalized picks, accumulators, urgency prompts, or staking or bankroll
        instructions. It does not promise profit and cannot remove the risk of losing money.
      </Paragraph>

      <SectionTitle>Independent help</SectionTitle>
      <Paragraph>
        If gambling is causing concern, stop and seek independent support from{" "}
        <a className={LINK_CLASS} href="https://www.gamcare.org.uk/">
          GamCare
        </a>{" "}
        or{" "}
        <a className={LINK_CLASS} href="https://www.gambleaware.org/">
          GambleAware
        </a>
        . In an emergency, contact local emergency services.
      </Paragraph>

      <ValueLinePolicyLinks />
    </CustomerPage>
  );
}
