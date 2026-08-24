import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { VALUE_LINE_REQUIRED_CONFIG_FIELDS } from "../lib/value-line-product";

const valueLineEnvironmentKeys = [
  "PB_VALUE_LINES_CHECKOUT_URL",
  "PB_VALUE_LINES_STRIPE_ACCOUNT_ID",
  "PB_VALUE_LINES_STRIPE_PRODUCT_ID",
  "PB_VALUE_LINES_STRIPE_PRICE_ID",
  "PB_VALUE_LINES_STRIPE_UNIT_AMOUNT_CENTS",
  "PB_VALUE_LINES_STRIPE_CURRENCY",
  "PB_VALUE_LINES_STRIPE_INTERVAL",
  "PB_VALUE_LINES_STRIPE_MODE",
  "PB_VALUE_LINES_SELLER_LEGAL_NAME",
  "PB_VALUE_LINES_SELLER_BUSINESS_ID",
  "PB_VALUE_LINES_SELLER_ADDRESS_LINE_1",
  "PB_VALUE_LINES_SELLER_POSTAL_CODE",
  "PB_VALUE_LINES_SELLER_CITY",
  "PB_VALUE_LINES_SELLER_COUNTRY_CODE",
  "PB_VALUE_LINES_TAX_NOTICE",
  "PB_VALUE_LINES_TAX_REVIEWED",
  "PB_VALUE_LINES_SUPPORT_EMAIL",
  "PB_VALUE_LINES_CONTACT_URL",
  "PB_VALUE_LINES_DELIVERY_METHOD",
  "PB_VALUE_LINES_EMAIL_PROVIDER",
  "PB_VALUE_LINES_EMAIL_SENDER",
  "PB_VALUE_LINES_EMAIL_SENDING_DOMAIN",
  "PB_VALUE_LINES_EMAIL_DOMAIN_VERIFIED",
  "PB_VALUE_LINES_EMAIL_PROVIDER_CLEARANCE",
  "PB_VALUE_LINES_TERMS_URL",
  "PB_VALUE_LINES_PRIVACY_URL",
  "PB_VALUE_LINES_REFUNDS_URL",
  "PB_VALUE_LINES_RESPONSIBLE_PLAY_URL",
  "PB_VALUE_LINES_SERVICE_BASE_URL",
  "PB_VALUE_LINES_RETURN_URL",
  "PB_VALUE_LINES_CANCEL_URL",
  "PB_VALUE_LINES_ACTIVATION",
] as const;

const repositoryRoot = process.cwd();
const tsxLoader = pathToFileURL(
  path.join(repositoryRoot, "node_modules", "tsx", "dist", "loader.mjs"),
).href;
const productionEnvironment: Record<string, string> = {
  PB_VALUE_LINES_CHECKOUT_URL: "https://buy.stripe.com/7sIaEW4vB8qL2mN5kR",
  PB_VALUE_LINES_STRIPE_ACCOUNT_ID: "acct_1PBVLines9EUR",
  PB_VALUE_LINES_STRIPE_PRODUCT_ID: "prod_PBVLines2026",
  PB_VALUE_LINES_STRIPE_PRICE_ID: "price_PBVLinesEUR9Month",
  PB_VALUE_LINES_STRIPE_UNIT_AMOUNT_CENTS: "900",
  PB_VALUE_LINES_STRIPE_CURRENCY: "EUR",
  PB_VALUE_LINES_STRIPE_INTERVAL: "month",
  PB_VALUE_LINES_STRIPE_MODE: "live",
  PB_VALUE_LINES_SELLER_LEGAL_NAME: "Northern Metrics Oy",
  PB_VALUE_LINES_SELLER_BUSINESS_ID: "FI-9274610-4",
  PB_VALUE_LINES_SELLER_ADDRESS_LINE_1: "Esplanadi 42",
  PB_VALUE_LINES_SELLER_POSTAL_CODE: "00130",
  PB_VALUE_LINES_SELLER_CITY: "Helsinki",
  PB_VALUE_LINES_SELLER_COUNTRY_CODE: "FI",
  PB_VALUE_LINES_TAX_NOTICE: "€9 monthly including applicable tax",
  PB_VALUE_LINES_TAX_REVIEWED: "confirmed",
  PB_VALUE_LINES_SUPPORT_EMAIL: "support@punditbench.com",
  PB_VALUE_LINES_CONTACT_URL: "https://punditbench.com/contact/",
  PB_VALUE_LINES_DELIVERY_METHOD: "Issues are delivered by email and subscriber dashboard",
  PB_VALUE_LINES_EMAIL_PROVIDER: "Resend",
  PB_VALUE_LINES_EMAIL_SENDER: "issues@updates.punditbench.com",
  PB_VALUE_LINES_EMAIL_SENDING_DOMAIN: "updates.punditbench.com",
  PB_VALUE_LINES_EMAIL_DOMAIN_VERIFIED: "verified",
  PB_VALUE_LINES_EMAIL_PROVIDER_CLEARANCE: "approved",
  PB_VALUE_LINES_TERMS_URL: "https://punditbench.com/value-lines/terms/",
  PB_VALUE_LINES_PRIVACY_URL: "https://punditbench.com/value-lines/privacy/",
  PB_VALUE_LINES_REFUNDS_URL: "https://punditbench.com/value-lines/refunds/",
  PB_VALUE_LINES_RESPONSIBLE_PLAY_URL: "https://punditbench.com/responsible-play/",
  PB_VALUE_LINES_SERVICE_BASE_URL: "https://members.punditbench.com",
  PB_VALUE_LINES_RETURN_URL: "https://members.punditbench.com/checkout/complete",
  PB_VALUE_LINES_CANCEL_URL: "https://members.punditbench.com/checkout/cancelled",
  PB_VALUE_LINES_ACTIVATION: "enabled",
};

interface ValidatorRunOptions {
  args?: string[];
  cwd?: string;
}

function runValidator(
  environment: Record<string, string> = {},
  options: ValidatorRunOptions = {},
) {
  const cleared = Object.fromEntries(valueLineEnvironmentKeys.map((key) => [key, ""]));
  return spawnSync(
    process.execPath,
    [
      "--import",
      tsxLoader,
      path.join(repositoryRoot, "scripts", "validate-value-lines-offer.ts"),
      ...(options.args ?? []),
    ],
    {
      cwd: options.cwd ?? repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, ...cleared, ...environment },
    },
  );
}

function makeTemporaryExport(html?: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "punditbench-value-lines-export-"));
  if (html !== undefined) {
    const directory = path.join(root, "out", "value-lines");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "index.html"), html);
  }
  return root;
}

describe("Value Lines deployment configuration", () => {
  it("keeps one explicit build-time environment key per fail-closed product field", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib", "value-line-product.ts"),
      "utf8",
    );

    expect(valueLineEnvironmentKeys).toHaveLength(VALUE_LINE_REQUIRED_CONFIG_FIELDS.length);
    for (const key of valueLineEnvironmentKeys) {
      expect(source).toContain(`process.env.${key}`);
    }
  });

  it("allows a deliberately closed preview build", () => {
    const result = runValidator();

    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("closed preview");
  });

  it("blocks an enabled build when any activation field is incomplete", () => {
    const result = runValidator({ PB_VALUE_LINES_ACTIVATION: "enabled" });

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Refusing to build with incomplete Value Lines activation",
    );
    expect(`${result.stdout}\n${result.stderr}`).toContain("checkoutUrl");
  });

  it("accepts a complete production-shaped activation record", () => {
    const result = runValidator(productionEnvironment);

    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("live activation record validated");
  });

  it("verifies the canonical live export under process.cwd()", () => {
    const root = makeTemporaryExport(
      `<a href="${productionEnvironment.PB_VALUE_LINES_CHECKOUT_URL}">Subscribe for <span>€9/month</span></a>`,
    );
    try {
      const result = runValidator(productionEnvironment, {
        args: ["--verify-export"],
        cwd: root,
      });

      expect(result.status).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain("exported live checkout verified");
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  });

  it("rejects a canonical live export whose checkout exists only in scripts and styles", () => {
    const root = makeTemporaryExport(`
      <script>const checkout = "${productionEnvironment.PB_VALUE_LINES_CHECKOUT_URL}";</script>
      <style>.offer::before { content: "Subscribe for €9/month"; }</style>
    `);
    try {
      const result = runValidator(productionEnvironment, {
        args: ["--verify-export"],
        cwd: root,
      });

      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        "Value Lines export does not contain the configured live checkout",
      );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  });

  it("does not allow an environment variable to redirect canonical export verification", () => {
    const canonicalRoot = makeTemporaryExport();
    const decoyRoot = makeTemporaryExport(
      `<a href="${productionEnvironment.PB_VALUE_LINES_CHECKOUT_URL}">Subscribe for €9/month</a>`,
    );
    try {
      const result = runValidator(
        { ...productionEnvironment, PB_VALUE_LINES_EXPORT_ROOT: decoyRoot },
        { args: ["--verify-export"], cwd: canonicalRoot },
      );

      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        path.join(canonicalRoot, "out", "value-lines", "index.html"),
      );
    } finally {
      fs.rmSync(canonicalRoot, { force: true, recursive: true });
      fs.rmSync(decoyRoot, { force: true, recursive: true });
    }
  });

  it("verifies the canonical rendered fallback for a deliberately closed export", () => {
    const root = makeTemporaryExport(
      "<section><p>Checkout unavailable</p><button disabled>Checkout unavailable</button></section>",
    );
    try {
      const result = runValidator({}, { args: ["--verify-export"], cwd: root });

      expect(result.status).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain("exported closed state verified");
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  });

  it("rejects a closed export whose fallback exists only in a script", () => {
    const root = makeTemporaryExport(
      '<script>const closed = "Checkout unavailable";</script>',
    );
    try {
      const result = runValidator({}, { args: ["--verify-export"], cwd: root });

      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        "Value Lines export does not contain the configured closed state",
      );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  });

  it("runs the Value Lines validator before and after deployable builds only", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const build = packageJson.scripts.build;
    const validator = "node --import tsx scripts/validate-value-lines-offer.ts";
    const postExportValidator = `${validator} --verify-export`;

    expect(build.indexOf(validator)).toBeGreaterThanOrEqual(0);
    expect(build.indexOf(validator)).toBeLessThan(build.indexOf("next build"));
    expect(build.indexOf(postExportValidator)).toBeGreaterThan(build.indexOf("next build"));
    expect(packageJson.scripts["build:ci"]).not.toContain("validate-value-lines-offer");
  });
});
