import * as fs from "node:fs";
import * as path from "node:path";
import {
  verifyClosedValueLineOfferHtml,
  verifyValueLineOfferHtml,
} from "../lib/value-line-offer-export";
import {
  validateValueLineCheckout,
  valueLineCheckoutFromEnvironment,
} from "../lib/value-line-product";

function fail(message: string): void {
  console.error(message);
  process.exitCode = 1;
}

const offer = valueLineCheckoutFromEnvironment();
const activation = offer.activation?.trim();
let expectedExportState: "closed" | "live" | null = null;

if (!activation || activation === "disabled") {
  expectedExportState = "closed";
  console.log("validate-value-lines-offer: closed preview configuration accepted");
} else if (activation !== "enabled") {
  fail(
    `Refusing to build with invalid Value Lines activation token: ${JSON.stringify(activation)}.`,
  );
} else {
  const validation = validateValueLineCheckout(offer);
  if (!validation.ready) {
    fail(
      `Refusing to build with incomplete Value Lines activation: ${validation.invalidFields.join(
        ", ",
      )}.`,
    );
  } else {
    expectedExportState = "live";
    console.log("validate-value-lines-offer: live activation record validated");
  }
}

if (
  process.argv.includes("--verify-export") &&
  expectedExportState !== null &&
  process.exitCode !== 1
) {
  const exportPath = path.join(process.cwd(), "out", "value-lines", "index.html");
  if (!fs.existsSync(exportPath)) {
    fail(`Value Lines offer export is missing: ${exportPath}`);
  } else {
    const html = fs.readFileSync(exportPath, "utf8");
    if (expectedExportState === "live") {
      if (!offer.checkoutUrl) {
        fail("Value Lines live export verification is missing its validated checkout URL.");
      } else if (!verifyValueLineOfferHtml(html, offer.checkoutUrl).ok) {
        fail("Value Lines export does not contain the configured live checkout.");
      } else {
        console.log("validate-value-lines-offer: exported live checkout verified");
      }
    } else if (!verifyClosedValueLineOfferHtml(html, offer.serviceBaseUrl).ok) {
      fail("Value Lines export does not contain the configured closed state.");
    } else {
      console.log("validate-value-lines-offer: exported closed state verified");
    }
  }
}
