import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const deployingWorkflows = ["results-sync.yml", "predict-scheduler.yml"];
const obsoleteOfferNames = [
  "PB_BRIEF_CHECKOUT_URL",
  "PB_BRIEF_SELLER_NAME",
  "PB_BRIEF_SELLER_ADDRESS",
  "PB_BRIEF_SELLER_ID",
  "PB_BRIEF_SUPPORT_EMAIL",
  "PB_BRIEF_VAT_NOTICE",
  "PB_BRIEF_DELIVERY_METHOD",
  "PB_BRIEF_TERMS_URL",
  "PB_BRIEF_PRIVACY_URL",
  "PB_BRIEF_REFUNDS_URL",
];

describe("current product deployment configuration", () => {
  it.each(deployingWorkflows)("does not inject the obsolete brief offer into %s", (workflow) => {
    const source = fs.readFileSync(
      path.join(process.cwd(), ".github", "workflows", workflow),
      "utf8",
    );

    for (const name of obsoleteOfferNames) expect(source).not.toContain(name);
    expect(source).toContain("run: npm run build");
  });

  it("builds the public evidence site without an obsolete checkout secret", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts.build).toBe(
      "node --import tsx scripts/prepare-export.ts && next build",
    );
    expect(packageJson.scripts["build:ci"]).toBe(packageJson.scripts.build);
    expect(packageJson.scripts.build).not.toContain("validate-opening-round-offer");
  });

  it("uses the non-mutating site build in ci.yml", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), ".github", "workflows", "ci.yml"),
      "utf8",
    );
    expect(source).toContain("npm run build:ci");
  });
});
