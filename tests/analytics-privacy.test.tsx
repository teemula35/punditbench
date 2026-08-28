import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("analytics privacy disclosure", () => {
  it("discloses every consent-gated click measurement", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app", "about", "page.tsx"), "utf8");

    expect(source).toContain("If you accept in the consent banner");
    expect(source).toContain(
      "Value Lines product-link, homepage match-card and lock-alert interest clicks",
    );
    expect(source).toContain("no ads, no cross-site tracking");
  });
});
