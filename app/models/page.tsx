import type { Metadata } from "next";
import Link from "next/link";
import { loadRoster } from "@/lib/data";
import { modelSlug } from "@/lib/prompt";
import { PageTitle, TD_CLS, TH_CLS, TierChip } from "../ui";

export const metadata: Metadata = {
  title: "Models",
  description: "The 18-model roster: every LLM competing in PunditBench, with pricing and cutoffs.",
};

function price(n?: number): string {
  return n === undefined ? "—" : `$${n}`;
}

export default function ModelsPage() {
  const roster = [...loadRoster()].sort(
    (a, b) => a.vendor.localeCompare(b.vendor) || a.label.localeCompare(b.label),
  );

  return (
    <div>
      <PageTitle
        kicker="The roster"
        title="Models"
        sub="18 models across 10 vendors, accessed through OpenRouter: each vendor's current flagship plus, where available, one small model. The roster was frozen at the group-stage prediction run — models added later would appear as unranked exhibition entries."
      />
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/60">
            <tr>
              <th className={TH_CLS}>Model</th>
              <th className={TH_CLS}>Vendor</th>
              <th className={TH_CLS}>Tier</th>
              <th className={TH_CLS}>Knowledge cutoff</th>
              <th className={`${TH_CLS} text-right`}>In / Out ($ per M tokens)</th>
              <th className={TH_CLS}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {roster.map((m) => {
              const slug = modelSlug(m.id);
              return (
                <tr key={m.id} className="hover:bg-zinc-900/40">
                  <td className={TD_CLS}>
                    <Link
                      href={`/models/${slug}/`}
                      className="font-medium text-zinc-100 hover:text-emerald-400"
                    >
                      {m.label}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-zinc-600">{m.id}</p>
                  </td>
                  <td className={`${TD_CLS} text-zinc-300`}>{m.vendor}</td>
                  <td className={TD_CLS}>
                    <TierChip tier={m.tier} />
                  </td>
                  <td className={`${TD_CLS} tabular-nums text-zinc-400`}>
                    {m.knowledge_cutoff && m.knowledge_cutoff !== "unknown"
                      ? m.knowledge_cutoff
                      : "unknown"}
                  </td>
                  <td className={`${TD_CLS} whitespace-nowrap text-right tabular-nums text-zinc-400`}>
                    {price(m.pricing_prompt_usd_per_m)} / {price(m.pricing_completion_usd_per_m)}
                  </td>
                  <td className={`${TD_CLS} text-right`}>
                    <Link href={`/models/${slug}/`} className="text-xs text-emerald-400 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-600">
        Knowledge cutoffs differ between models; that asymmetry is part of what the benchmark
        measures and is shown rather than corrected for. Full snapshot details in{" "}
        <a href="/data/roster.json" className="text-emerald-400 hover:underline">
          data/roster.json
        </a>
        .
      </p>
    </div>
  );
}
