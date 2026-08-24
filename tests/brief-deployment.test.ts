import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const tsxLoader = pathToFileURL(
  path.join(repositoryRoot, "node_modules", "tsx", "dist", "loader.mjs"),
).href;
const deployingWorkflows = ["results-sync.yml", "predict-scheduler.yml"];
const offerBuildSecrets = [
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

function runBuildConfigValidator(
  environment: Record<string, string> = {},
  args: string[] = [],
  cwd = repositoryRoot,
) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      tsxLoader,
      path.join(repositoryRoot, "scripts", "validate-opening-round-offer.ts"),
      ...args,
    ],
    {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        PB_BRIEF_CHECKOUT_URL: "",
        ...environment,
      },
    },
  );
}

describe("paid-brief deployment configuration", () => {
  it.each(deployingWorkflows)("passes the offer secrets into %s builds", (workflow) => {
    const source = fs.readFileSync(
      path.join(process.cwd(), ".github", "workflows", workflow),
      "utf8",
    );

    for (const secret of offerBuildSecrets) {
      expect(source).toContain(`${secret}: \${{ secrets.${secret} }}`);
    }
    expect(source).toContain("run: npm run build");
  });

  it("keeps deployable and non-deploying builds separate", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts.build).toMatch(
      /^node --import tsx scripts\/validate-opening-round-offer\.ts && /,
    );
    expect(packageJson.scripts.build).toMatch(
      /next build && node --import tsx scripts\/validate-opening-round-offer\.ts --verify-export && node --import tsx scripts\/validate-value-lines-offer\.ts --verify-export$/,
    );
    expect(packageJson.scripts["build:ci"]).toBe(
      "node --import tsx scripts/prepare-export.ts && next build",
    );
  });

  it("uses the non-deploying build only in ci.yml", () => {
    const workflowsDir = path.join(process.cwd(), ".github", "workflows");
    const users = fs
      .readdirSync(workflowsDir)
      .filter((file) =>
        fs.readFileSync(path.join(workflowsDir, file), "utf8").includes("npm run build:ci"),
      );

    expect(users).toEqual(["ci.yml"]);
  });

  it("blocks a build when the live checkout configuration disappears", () => {
    const result = runBuildConfigValidator();

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Refusing to build with the opening-round checkout closed",
    );
  });

  it("blocks a build when the configured checkout is not a Stripe payment link", () => {
    const result = runBuildConfigValidator({
      PB_BRIEF_CHECKOUT_URL: "https://example.com/not-checkout",
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "PB_BRIEF_CHECKOUT_URL must be an HTTPS buy.stripe.com payment link",
    );
  });

  it("accepts a live Stripe payment link", () => {
    const result = runBuildConfigValidator({
      PB_BRIEF_CHECKOUT_URL: "https://buy.stripe.com/test-opening-round",
    });

    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "live checkout configuration present",
    );
  });

  it("pins export verification to the deployed out directory under cwd", () => {
    const source = fs.readFileSync(
      path.join(repositoryRoot, "scripts", "validate-opening-round-offer.ts"),
      "utf8",
    );

    expect(source).toMatch(
      /path\.join\(\s*process\.cwd\(\),\s*"out",\s*"briefs",\s*"opening-round-2026",\s*"index\.html",?\s*\)/,
    );
  });

  it("rejects an exported checkout spoof through the executable validator", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "punditbench-offer-export-"));
    const exportDir = path.join(root, "out", "briefs", "opening-round-2026");
    fs.mkdirSync(exportDir, { recursive: true });
    fs.writeFileSync(
      path.join(exportDir, "index.html"),
      '<script>const href = "https://buy.stripe.com/test-opening-round"; const label = "Buy the brief for €5";</script>',
      "utf8",
    );

    try {
      const result = runBuildConfigValidator(
        { PB_BRIEF_CHECKOUT_URL: "https://buy.stripe.com/test-opening-round" },
        ["--verify-export"],
        root,
      );

      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        "export does not contain the configured live checkout",
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
