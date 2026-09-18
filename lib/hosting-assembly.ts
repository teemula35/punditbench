import fs from "node:fs";
import path from "node:path";

export type HostingMode =
  | { schema: "punditbench-hosting.v1"; mode: "benchmark" }
  | { schema: "punditbench-hosting.v1"; mode: "product"; target: { serviceId: string; region: string } }
  | { schema: "punditbench-hosting.v2"; mode: "subpage"; target: { serviceId: string; region: string }; authDomain?: string };

const regions = new Set([
  "asia-east1", "asia-east2", "asia-northeast1", "asia-northeast2", "asia-northeast3", "asia-south1", "asia-south2", "asia-southeast1", "asia-southeast2", "asia-southeast3",
  "australia-southeast1", "australia-southeast2", "europe-central2", "europe-north1", "europe-southwest1", "europe-west1", "europe-west12", "europe-west2", "europe-west3", "europe-west4", "europe-west6", "europe-west8", "europe-west9",
  "me-central1", "me-central2", "me-west1", "northamerica-northeast1", "northamerica-northeast2", "southamerica-east1", "southamerica-west1", "us-central1", "us-east1", "us-east4", "us-east5", "us-south1", "us-west1", "us-west2", "us-west3", "us-west4",
]);
const forwardedPaths = ["/", "/how-it-works", "/how-it-works/", "/pricing", "/pricing/", "/product-assets/**", "/api/demo/**"];
const subpagePaths = ["/app", "/app/**"];
const rootRepresentations = ["index.html", "index.txt", "__next._full.txt", "__next._tree.txt", "__next.__PAGE__.txt"];
const collisions = ["index.htm", "how-it-works", "how-it-works.html", "pricing", "pricing.html", "product-assets", "api/demo"];
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** Small ASCII-only configuration: escaped keys, duplicate fields and unknown fields
 * are rejected rather than resolved using JSON's last-key-wins behavior. */
export function parseHostingMode(text: string): HostingMode {
  try {
    if (text.length > 2048 || text.includes("\\")) throw new Error();
    const keys = [...text.matchAll(/"([A-Za-z][A-Za-z0-9]*)"\s*:/gu)].map(match => match[1]);
    if (new Set(keys).size !== keys.length) throw new Error();
    const value: unknown = JSON.parse(text);
    if (!object(value)) throw new Error();
    if (value.schema === "punditbench-hosting.v1" && value.mode === "benchmark" && exact(value, ["schema", "mode"])) return { schema: value.schema, mode: "benchmark" };
    const subpage = value.schema === "punditbench-hosting.v2" && value.mode === "subpage";
    if (!subpage && !(value.schema === "punditbench-hosting.v1" && value.mode === "product")) throw new Error();
    const hasAuthDomain = subpage && Object.hasOwn(value, "authDomain");
    if (!exact(value, hasAuthDomain ? ["schema", "mode", "target", "authDomain"] : ["schema", "mode", "target"]) || !object(value.target) || !exact(value.target, ["serviceId", "region"])) throw new Error();
    const { serviceId, region } = value.target;
    if (typeof serviceId !== "string" || !/^[a-z](?:[a-z0-9-]{0,47}[a-z0-9])?$/u.test(serviceId) || typeof region !== "string" || !regions.has(region)) throw new Error();
    if (subpage) {
      if (hasAuthDomain && (typeof value.authDomain !== "string" || value.authDomain.length > 253 ||
          !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(value.authDomain))) throw new Error();
      return { schema: "punditbench-hosting.v2", mode: "subpage", target: { serviceId, region }, ...(hasAuthDomain ? { authDomain: value.authDomain as string } : {}) };
    }
    return { schema: "punditbench-hosting.v1", mode: "product", target: { serviceId, region } };
  } catch { throw new Error("Invalid hosting mode"); }
}

export function renderHostingConfiguration(base: string, input: HostingMode): string {
  const mode = parseHostingMode(JSON.stringify(input));
  let config: { hosting: Record<string, unknown>; [key: string]: unknown };
  try {
    const parsed: unknown = JSON.parse(base);
    if (!object(parsed) || !object(parsed.hosting) || parsed.hosting.public !== "out" || parsed.hosting.trailingSlash !== true ||
        Object.hasOwn(parsed.hosting, "rewrites") || Object.hasOwn(parsed.hosting, "redirects") || !Array.isArray(parsed.hosting.headers) || !Array.isArray(parsed.hosting.ignore)) throw new Error();
    config = parsed as typeof config;
  } catch { throw new Error("Invalid hosting base"); }
  if (mode.mode === "benchmark") return base;
  if (mode.mode === "subpage") {
    // Exclude this namespace from the benchmark's global CSP/COOP, rather than
    // relying on a CDN or browser choosing one of two conflicting policies.
    const headers = (config.hosting.headers as unknown[]).map(entry => {
      if (!object(entry) || !Array.isArray(entry.headers)) throw new Error("Invalid hosting base");
      return entry.source === "**" ? { ...entry, source: "!/app{,/**}" } : entry;
    });
    const policy = mode.authDomain
      ? `default-src 'none'; script-src 'self' https://apis.google.com; style-src 'self'; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://${mode.authDomain}; frame-src https://${mode.authDomain}; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`
      : "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";
    config.hosting.rewrites = subpagePaths.map(source => ({ source, run: { ...mode.target } }));
    config.hosting.headers = [...headers, ...subpagePaths.map(source => ({ source, headers: [
      { key: "Cache-Control", value: "no-store" }, { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" }, { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: mode.authDomain ? "same-origin-allow-popups" : "same-origin" },
      { key: "Content-Security-Policy", value: policy },
    ] }))];
    return JSON.stringify(config, null, 2) + "\n";
  }
  config.hosting.rewrites = forwardedPaths.map(source => ({ source, run: { ...mode.target } }));
  config.hosting.headers = [...config.hosting.headers as unknown[], ...forwardedPaths.map(source => ({ source, headers: [
    { key: "Cache-Control", value: "no-store" }, { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Content-Security-Policy", value: "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" },
  ] }))];
  return JSON.stringify(config, null, 2) + "\n";
}

function rootedDirectory(directory: string): string {
  const resolved = path.resolve(directory);
  if (!fs.lstatSync(resolved).isDirectory() || fs.lstatSync(resolved).isSymbolicLink() || fs.realpathSync(resolved) !== resolved) throw new Error("Invalid export directory");
  return resolved;
}
function regularFile(file: string): boolean {
  const entry = fs.lstatSync(file, { throwIfNoEntry: false });
  return Boolean(entry?.isFile() && !entry.isSymbolicLink() && fs.realpathSync(file) === path.resolve(file));
}
/** Read the repository-owned mode/base before the build writes any export artifacts. */
export function validateHostingInputs(directory: string): { root: string; mode: HostingMode; configuration: string } {
  const root = rootedDirectory(directory);
  const config = rootedDirectory(path.join(root, "config"));
  const modeFile = path.join(config, "hosting-mode.json"), baseFile = path.join(config, "firebase-base.json");
  if (!regularFile(modeFile) || !regularFile(baseFile)) throw new Error("Invalid hosting inputs");
  const mode = parseHostingMode(fs.readFileSync(modeFile, "utf8"));
  const configuration = renderHostingConfiguration(fs.readFileSync(baseFile, "utf8"), mode);
  return { root, mode, configuration };
}

/** Post-build assembly changes firebase.json, plus root representations in v1 product mode only.
 * Validation is complete before the first write; data/source/tag trees are never inputs. */
export function assembleHostingExport(directory: string): void {
  const { root, mode, configuration } = validateHostingInputs(directory);
  const output = rootedDirectory(path.join(root, "out"));
  if (!regularFile(path.join(output, "index.html")) || !regularFile(path.join(output, "index.txt")) ||
      !regularFile(path.join(output, "benchmark", "index.html")) || !regularFile(path.join(output, "benchmark", "index.txt"))) throw new Error("Invalid benchmark export");
  if (fs.readdirSync(output, { recursive: true, withFileTypes: true }).some(entry => entry.isSymbolicLink())) throw new Error("Invalid benchmark export");
  const firebase = path.join(root, "firebase.json");
  if (!regularFile(firebase)) throw new Error("Invalid hosting output");
  if (mode.mode === "subpage" && fs.readdirSync(output).some(name => name === "app" || name.startsWith("app."))) throw new Error("Conflicting hosting export");
  if (mode.mode === "product") {
    if (collisions.some(file => fs.existsSync(path.join(output, file)))) throw new Error("Conflicting hosting export");
    const unknownRootPayload = fs.readdirSync(output).some(name => (name.startsWith("__next.") || name.startsWith("index.")) && !rootRepresentations.includes(name));
    if (unknownRootPayload || rootRepresentations.some(name => fs.existsSync(path.join(output, name)) && !regularFile(path.join(output, name)))) throw new Error("Unrecognized root export");
    for (const name of rootRepresentations) {
      const file = path.resolve(output, name);
      if (path.dirname(file) !== output) throw new Error("Invalid root export target");
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
  fs.writeFileSync(firebase, configuration, "utf8");
}
