import path from "node:path";
import { fileURLToPath } from "node:url";
import { assembleHostingExport, validateHostingInputs } from "../lib/hosting-assembly";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arguments_ = process.argv.slice(2);
try {
  if (arguments_.length === 1 && arguments_[0] === "--validate") validateHostingInputs(root);
  else if (arguments_.length === 0) assembleHostingExport(root);
  else throw new Error("Unexpected assembly arguments");
  process.stdout.write(arguments_.length ? "hosting: configuration valid\n" : "hosting: export assembled\n");
} catch {
  process.stderr.write("Hosting assembly failed. Check the versioned mode and completed benchmark export.\n");
  process.exitCode = 1;
}
