import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LockAlertInterest, trackLockAlertInterest } from "../app/lock-alert-interest";

describe("lock-alert interest", () => {
  it("reports one distinct consent-gated interest event", () => {
    const report = vi.fn();

    const recorded = trackLockAlertInterest(report);

    expect(recorded).toBe(true);
    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith("event", "lock_alert_interest", {
      content_type: "product_interest",
      item_id: "prediction_lock_alerts",
    });
  });

  it("does not claim a measurement when analytics is unavailable", () => {
    expect(trackLockAlertInterest(undefined)).toBe(false);
  });

  it("renders a no-email interest control without a signup form", () => {
    const html = renderToStaticMarkup(<LockAlertInterest />);

    expect(html).toContain("Lock alerts · Interest check");
    expect(html).toContain("Would you use lock alerts?");
    expect(html).toContain("fully locked and public");
    expect(html).toContain("Alerts are not live");
    expect(html).toContain("no email or signup");
    expect(html).toContain('type="button"');
    expect(html).toContain('data-analytics-event="lock_alert_interest"');
    expect(html).toContain("I would use this");
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="email"');
    expect(html).not.toContain('name="tag"');
    expect(html).not.toContain("Buttondown");
    expect(html).not.toContain("separate interest list");
    expect(html).not.toContain("pilot opens");
  });
});
