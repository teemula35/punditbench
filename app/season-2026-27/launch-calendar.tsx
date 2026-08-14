import React from "react";
import { SEASON_LAUNCHES } from "./launches";

export function SeasonLaunchCalendar() {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-zinc-100">Launch calendar</h2>
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-800/70">
            {SEASON_LAUNCHES.map((launch) => (
              <tr key={launch.league}>
                <td className="px-4 py-2.5 font-medium text-zinc-100">{launch.league}</td>
                <td className="px-4 py-2.5 text-zinc-400">{launch.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        Dates from the official fixture feeds; TV scheduling can still move individual kickoffs.
      </p>
    </section>
  );
}
