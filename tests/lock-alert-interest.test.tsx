import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LockAlertInterest } from "../app/lock-alert-interest";
import { NotifyForm } from "../app/notify";
import { BUTTONDOWN_USERNAME } from "../lib/site";

describe("lock-alert interest form", () => {
  it("collects a separate tagged opt-in without promising a live alert service", () => {
    const html = renderToStaticMarkup(<LockAlertInterest />);

    expect(html).toContain("Lock alerts · Interest list");
    expect(html).toContain("fully locked and public");
    expect(html).toContain("separate from the matchday notes");
    expect(html).toContain("Alerts are not live yet");
    expect(BUTTONDOWN_USERNAME).toBeTruthy();
    expect(html).toContain(
      `action="https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USERNAME}"`,
    );
    expect(html).toContain('method="post"');
    expect(html).toContain('type="email"');
    expect(html).toContain('name="email"');
    expect(html).toContain('required=""');
    expect(html).toContain('name="tag"');
    expect(html).toContain('value="prediction-lock-alerts"');
    expect(html).toContain("Join the interest list");
    expect(html).toContain("Double opt-in");
    expect(html).not.toContain("the moment");
    expect(html).not.toContain("whenever");
  });

  it("keeps the existing signup explicitly scoped and tagged to editorial matchday notes", () => {
    const html = renderToStaticMarkup(<NotifyForm />);

    expect(html).toContain("Get matchday notes");
    expect(html).toContain("A short note per matchday round");
    expect(html).toContain("Lock alerts use the separate interest list");
    expect(html).toContain('method="post"');
    expect(html).toContain('type="email"');
    expect(html).toContain('name="email"');
    expect(html).toContain('required=""');
    expect(html).toContain('name="tag"');
    expect(html).toContain('value="matchday-notes"');
    expect(html).not.toContain("first league picks lock");
    expect(html).not.toContain("Notify me");
  });

  it("uses one neutral double-opt-in flow for editorial notes and alert interest", () => {
    const subscribedSource = fs
      .readFileSync(path.join(process.cwd(), "app", "subscribed", "page.tsx"), "utf8")
      .replace(/\s+/g, " ");
    const confirmedSource = fs
      .readFileSync(path.join(process.cwd(), "app", "confirmed", "page.tsx"), "utf8")
      .replace(/\s+/g, " ");

    expect(subscribedSource).toContain("confirm the emails you chose");
    expect(subscribedSource).not.toContain("league launch");
    expect(confirmedSource).toContain("You&apos;re confirmed for the emails you chose");
    expect(confirmedSource).not.toContain("the moment");
    expect(confirmedSource).not.toContain("first league picks lock in August");
  });
});
