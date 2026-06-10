"use client";

/**
 * Consent-gated Google Analytics 4 ("basic" Consent Mode v2).
 *
 * Nothing is injected and no cookie is set until the visitor explicitly
 * accepts the banner. The choice ("granted" | "denied") lives in localStorage
 * under `pb-consent`; clearing it (footer "Analytics settings") brings the
 * banner back. While GA_MEASUREMENT_ID is empty, both exports render nothing
 * and the site behaves as if this file did not exist.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GA_MEASUREMENT_ID } from "@/lib/site";

const CONSENT_KEY = "pb-consent";
const GA_SCRIPT_ID = "pb-ga4-script";

type ConsentChoice = "granted" | "denied";

type ConsentModeParams = Partial<
  Record<"ad_storage" | "ad_user_data" | "ad_personalization" | "analytics_storage", ConsentChoice>
>;

interface GtagFunction {
  (command: "js", date: Date): void;
  (command: "config", targetId: string, params?: Record<string, unknown>): void;
  (command: "consent", action: "default" | "update", params: ConsentModeParams): void;
  (command: "event", eventName: string, params?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFunction;
  }
}

function readStoredConsent(): ConsentChoice | null {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null; // storage unavailable → treat as "no choice yet"
  }
}

function storeConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* storage unavailable — the banner will simply reappear next visit */
  }
}

/** Best-effort removal of GA cookies (relevant when consent is revoked). */
function deleteGaCookies(): void {
  const expire = "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name || !name.startsWith("_ga")) continue;
    document.cookie = `${name}${expire}`;
    document.cookie = `${name}${expire}; domain=${window.location.hostname}`;
    document.cookie = `${name}${expire}; domain=.${window.location.hostname}`;
  }
}

/** Injects gtag.js and bootstraps Consent Mode v2. Runs only after Accept. */
function loadAnalytics(): void {
  if (document.getElementById(GA_SCRIPT_ID)) return; // already loaded

  const dataLayer: unknown[] = window.dataLayer ?? [];
  window.dataLayer = dataLayer;
  function gtagImpl(): void {
    // gtag.js only processes `arguments` objects pushed to dataLayer — a
    // plain array would be silently ignored, so don't "modernize" this.
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  }
  const gtag: GtagFunction = gtagImpl;
  window.gtag = gtag;

  // Consent Mode v2, "basic" flavour: everything denied by default, then
  // analytics_storage only is granted. The ad signals stay denied forever —
  // this site runs no ads and does no cross-site tracking.
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  gtag("consent", "update", { analytics_storage: "granted" });
  gtag("js", new Date());
  // send_page_view: false — page views are sent manually so App Router soft
  // navigations are counted and the first view is not double-counted.
  gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true, send_page_view: false });

  const script = document.createElement("script");
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(script);
}

const BANNER_BTN_CLS =
  "flex-1 cursor-pointer rounded-md border px-4 py-1.5 text-sm font-semibold transition-colors sm:flex-none";

/** Consent banner + GA loader. Renders nothing while GA_MEASUREMENT_ID is empty. */
export function Analytics() {
  if (!GA_MEASUREMENT_ID) return null;
  return <ConsentManager />;
}

function ConsentManager() {
  // null = stored choice not read yet (also what the prerendered HTML shows,
  // so hydration always matches); "unset" = no choice made → show the banner.
  const [consent, setConsent] = useState<ConsentChoice | "unset" | null>(null);
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    setConsent(readStoredConsent() ?? "unset");
  }, []);

  // After consent: load GA once, then send a page_view per route (the App
  // Router soft-navigates between static pages, so GA sees no real loads).
  useEffect(() => {
    if (consent !== "granted") return;
    loadAnalytics();
    if (lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;
    window.gtag?.("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [consent, pathname]);

  if (consent !== "unset") return null;

  const choose = (choice: ConsentChoice): void => {
    storeConsent(choice);
    if (choice === "denied") deleteGaCookies();
    setConsent(choice);
  };

  return (
    <div
      role="region"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-6">
        <p className="flex-1 text-xs leading-relaxed text-zinc-400 sm:text-sm">
          We&apos;d like to use Google Analytics to count visitors. Cookies are set only if you
          accept. No ads, no cross-site tracking.{" "}
          <Link
            href="/about/#privacy"
            className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-400"
          >
            Details
          </Link>
        </p>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => choose("granted")}
            className={`${BANNER_BTN_CLS} border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20`}
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => choose("denied")}
            className={`${BANNER_BTN_CLS} border-zinc-600 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700`}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Footer control to revoke/re-decide the analytics choice: clears the stored
 * consent and reloads, so the banner reappears. Renders nothing while
 * GA_MEASUREMENT_ID is empty.
 */
export function AnalyticsSettingsLink() {
  if (!GA_MEASUREMENT_ID) return null;
  return (
    <button
      type="button"
      className="cursor-pointer hover:text-emerald-400"
      onClick={() => {
        try {
          window.localStorage.removeItem(CONSENT_KEY);
        } catch {
          /* storage unavailable — nothing to reset */
        }
        window.location.reload();
      }}
    >
      Analytics settings
    </button>
  );
}
