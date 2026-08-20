"use client";

import React, { useState } from "react";

export type LockAlertAnalyticsReporter = (
  command: "event",
  eventName: string,
  params?: Record<string, unknown>,
) => void;

function activeAnalyticsReporter(): LockAlertAnalyticsReporter | undefined {
  if (typeof window === "undefined") return undefined;
  return window.gtag;
}

/** Records interest only when consent-gated analytics is already loaded. */
export function trackLockAlertInterest(
  report: LockAlertAnalyticsReporter | undefined = activeAnalyticsReporter(),
): boolean {
  if (!report) return false;
  report("event", "lock_alert_interest", {
    content_type: "product_interest",
    item_id: "prediction_lock_alerts",
  });
  return true;
}

type InterestState = "idle" | "recorded" | "analytics-off";

export function LockAlertInterest() {
  const [interestState, setInterestState] = useState<InterestState>("idle");

  const recordInterest = () => {
    setInterestState(trackLockAlertInterest() ? "recorded" : "analytics-off");
  };

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Lock alerts · Interest check
      </p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-100">Would you use lock alerts?</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        A short email after a league matchday is fully locked and public. Alerts are not live. Tap
        once to show interest — no email or signup.
      </p>
      {interestState !== "recorded" && (
        <button
          type="button"
          data-analytics-event="lock_alert_interest"
          onClick={recordInterest}
          className="mt-4 rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-emerald-400/50 hover:text-emerald-300"
        >
          I would use this
        </button>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-xs text-zinc-600">
        {interestState === "recorded"
          ? "Thanks — interest recorded by site analytics. No contact details were collected."
          : interestState === "analytics-off"
            ? "Not recorded because analytics is off. No contact details were collected."
            : "Counted only when consent-gated analytics is enabled."}
      </p>
    </section>
  );
}
