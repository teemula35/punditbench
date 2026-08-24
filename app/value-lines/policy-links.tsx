import Link from "next/link";
import { VALUE_LINE_CANONICAL_CUSTOMER_PATHS } from "@/lib/value-line-product";

const links = [
  ["Terms", VALUE_LINE_CANONICAL_CUSTOMER_PATHS.termsUrl],
  ["Privacy", VALUE_LINE_CANONICAL_CUSTOMER_PATHS.privacyUrl],
  ["Cancellation and refunds", VALUE_LINE_CANONICAL_CUSTOMER_PATHS.refundsUrl],
  ["Responsible play", VALUE_LINE_CANONICAL_CUSTOMER_PATHS.responsiblePlayUrl],
  ["Value Lines contact", VALUE_LINE_CANONICAL_CUSTOMER_PATHS.contactUrl],
] as const;

export default function ValueLinePolicyLinks() {
  return (
    <nav aria-label="Value Lines customer information" className="mt-6">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-400">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link className="underline underline-offset-2 hover:text-zinc-200" href={href}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
