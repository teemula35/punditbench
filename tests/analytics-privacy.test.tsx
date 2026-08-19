import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("analytics privacy disclosure", () => {
  it("discloses consent-gated checkout-button click measurement", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app", "about", "page.tsx"), "utf8");

    expect(source).toContain("If you accept in the consent banner");
    expect(source).toContain("checkout-button clicks on the paid-brief page");
    expect(source).toContain("no ads, no cross-site tracking");
  });
});
