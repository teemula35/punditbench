"use client";

/**
 * Cookieless page-view counter. Fires one Firestore REST commit per route
 * view — increments a total, a per-day and a per-path counter. No cookies,
 * no localStorage, no identifiers of any kind: pure aggregate integers (see
 * firestore.rules — the public can only ever "+1" these documents). Runs for
 * every visitor regardless of the GA consent choice; the two systems are
 * independent and the privacy page describes both.
 */
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { COUNTER_API_KEY, COUNTER_PROJECT } from "@/lib/site";

const BASE = `https://firestore.googleapis.com/v1/projects/${COUNTER_PROJECT}/databases/(default)/documents`;

function docName(id: string): string {
  return `projects/${COUNTER_PROJECT}/databases/(default)/documents/counters/${id}`;
}

/** "/models/openai-gpt-4/" -> "p-models~openai-gpt-4" (Firestore IDs can't contain "/"). */
function pathDocId(pathname: string): string {
  const cleaned = pathname.replace(/^\/+|\/+$/g, "");
  const slug = cleaned === "" ? "home" : cleaned.replace(/\//g, "~");
  return `p-${slug.slice(0, 120)}`;
}

function increment(id: string): { transform: { document: string; fieldTransforms: object[] } } {
  return {
    transform: {
      document: docName(id),
      fieldTransforms: [{ fieldPath: "count", increment: { integerValue: "1" } }],
    },
  };
}

export function PageCounter() {
  const pathname = usePathname();
  const lastCounted = useRef<string | null>(null);

  useEffect(() => {
    if (!COUNTER_PROJECT || lastCounted.current === pathname) return;
    lastCounted.current = pathname;
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    fetch(`${BASE}:commit?key=${COUNTER_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [increment("total"), increment(`d-${day}`), increment(pathDocId(pathname))],
      }),
    }).catch(() => {
      /* blocked or offline — the counter is best-effort by design */
    });
  }, [pathname]);

  return null;
}

/** Footer badge showing the all-time page-view total. Silent on failure. */
export function PageViewBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!COUNTER_PROJECT) return;
    fetch(`${BASE}/counters/total?key=${COUNTER_API_KEY}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => {
        const v = doc?.fields?.count?.integerValue;
        if (v) setCount(Number(v));
      })
      .catch(() => {});
  }, []);

  if (count === null) return null;
  return (
    <span title="Cookieless page-view counter — anonymous aggregate only">
      {count.toLocaleString("en")} page views
    </span>
  );
}
