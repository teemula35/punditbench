import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { assembleHostingExport, parseHostingMode, renderHostingConfiguration } from "../lib/hosting-assembly";

const base = fs.readFileSync(path.join(process.cwd(), "config", "firebase-base.json"), "utf8");
const benchmark = '{"schema":"punditbench-hosting.v1","mode":"benchmark"}';
const product = '{"schema":"punditbench-hosting.v1","mode":"product","target":{"serviceId":"example-site","region":"europe-west1"}}';
const subpage = '{"schema":"punditbench-hosting.v2","mode":"subpage","target":{"serviceId":"example-app","region":"europe-west1"}}';
const roots: string[] = [];
function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pb-hosting-test-")); roots.push(root);
  for (const [file, value] of Object.entries({
    "index.html": "benchmark root", "index.txt": "root rsc", "__next._full.txt": "root full", "__next._tree.txt": "root tree", "__next.__PAGE__.txt": "root page",
    "benchmark/index.html": "overview and archive", "benchmark/index.txt": "benchmark rsc",
    "leagues/example/matches/1/index.html": "league deep link", "matches/1/index.html": "world cup deep link", "models/example/index.html": "model",
    "data/hashes/locked.json": "immutable hash", "data/competitions/example/raw-live/md1/model.jsonl": "public raw evidence",
    "_next/static/chunks/example.js": "shared benchmark chunk", "opengraph-image": "root image", "404.html": "not found", "robots.txt": "robots",
  })) { const target = path.join(root, "out", file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value); }
  fs.mkdirSync(path.join(root, "config"));
  fs.writeFileSync(path.join(root, "config", "firebase-base.json"), base);
  fs.writeFileSync(path.join(root, "config", "hosting-mode.json"), benchmark);
  fs.writeFileSync(path.join(root, "firebase.json"), base);
  return root;
}
const files = (root: string): Record<string, string> => Object.fromEntries(fs.readdirSync(path.join(root, "out"), { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile()).map(entry => { const file = path.join(entry.parentPath, entry.name); return [path.relative(path.join(root, "out"), file).replaceAll("\\", "/"), fs.readFileSync(file).toString("base64")]; }));
afterEach(() => { for (const root of roots.splice(0)) {
  const checked = fs.realpathSync(root), temporary = fs.realpathSync(os.tmpdir());
  if (checked !== path.resolve(root) || path.dirname(checked) !== temporary || !path.basename(checked).startsWith("pb-hosting-test-")) throw new Error("Unsafe test cleanup");
  fs.rmSync(checked, { recursive: true });
} });

describe("versioned hosting mode", () => {
  it("keeps the committed default in benchmark mode and its configuration byte-identical", () => {
    expect(parseHostingMode(fs.readFileSync("config/hosting-mode.json", "utf8"))).toEqual({ schema: "punditbench-hosting.v1", mode: "benchmark" });
    expect(renderHostingConfiguration(base, parseHostingMode(benchmark))).toBe(base);
  });
  it.each([
    "", "null", "[]", "{", '{"schema":"punditbench-hosting.v2","mode":"benchmark"}',
    '{"schema":"punditbench-hosting.v1"}', '{"schema":"punditbench-hosting.v1","mode":"unknown"}',
    '{"schema":"punditbench-hosting.v1","mode":"product"}',
    '{"schema":"punditbench-hosting.v1","mode":"benchmark","target":{"serviceId":"example-site","region":"europe-west1"}}',
    product.replace('"europe-west1"', '"unsupported-region"'), product.replace('"example-site"', '"https://unrelated.test"'),
    product.replace('"example-site"', '"../private"'), product.replace('"region":"europe-west1"', '"region":""'),
    product.replace('"mode":"product"', '"mode":"benchmark","mode":"product"'), product.replace('"mode"', '"m\\u006fde"'),
    product.replace('"region":"europe-west1"', '"region":"europe-west1","extra":true'),
  ])("rejects invalid or ambiguous configuration without defaults: %s", value => {
    expect(() => parseHostingMode(value)).toThrow("Invalid hosting mode");
  });
  it("generates narrow anonymous Cloud Run rewrites without altering the base", () => {
    const configured = JSON.parse(renderHostingConfiguration(base, parseHostingMode(product)));
    expect(configured.firestore).toEqual(JSON.parse(base).firestore);
    expect(configured.hosting.public).toBe("out"); expect(configured.hosting.trailingSlash).toBe(true);
    expect(configured.hosting.rewrites.map((rule: { source: string }) => rule.source)).toEqual([
      "/", "/how-it-works", "/how-it-works/", "/pricing", "/pricing/", "/product-assets/**", "/api/demo/**",
    ]);
    for (const rule of configured.hosting.rewrites) {
      expect(rule.run).toEqual({ serviceId: "example-site", region: "europe-west1" });
      const headers = configured.hosting.headers.filter((entry: { source: string }) => entry.source === rule.source).at(-1).headers;
      expect(headers).toContainEqual({ key: "Cache-Control", value: "no-store" });
      expect(headers).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" });
      expect(headers.find((entry: { key: string }) => entry.key === "Content-Security-Policy").value).toContain("frame-ancestors 'none'");
    }
    expect(JSON.parse(base).hosting.rewrites).toBeUndefined();
    expect(JSON.stringify(configured.hosting.rewrites)).not.toMatch(/customer|benchmark|leagues|matches|models|data/);
  });
});

describe("ordinary export assembly", () => {
  it("preserves every exported byte and root in default mode", () => {
    const root = fixture(), before = files(root);
    assembleHostingExport(root);
    expect(files(root)).toEqual(before); expect(fs.readFileSync(path.join(root, "firebase.json"), "utf8")).toBe(base);
  });
  it("removes all generated root representations only, preserving overview, deep links and evidence", () => {
    const root = fixture(), before = files(root);
    fs.writeFileSync(path.join(root, "config", "hosting-mode.json"), product);
    assembleHostingExport(root);
    for (const file of ["index.html", "index.txt", "__next._full.txt", "__next._tree.txt", "__next.__PAGE__.txt"]) delete before[file];
    expect(files(root)).toEqual(before);
    expect(JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8")).hosting.rewrites[0].source).toBe("/");
  });
  it("restores default configuration after a fresh benchmark export", () => {
    const root = fixture(); fs.writeFileSync(path.join(root, "config", "hosting-mode.json"), product); assembleHostingExport(root);
    fs.writeFileSync(path.join(root, "config", "hosting-mode.json"), benchmark);
    expect(() => assembleHostingExport(root)).toThrow("Invalid benchmark export");
    fs.writeFileSync(path.join(root, "out", "index.html"), "fresh root"); fs.writeFileSync(path.join(root, "out", "index.txt"), "fresh rsc");
    assembleHostingExport(root);
    expect(fs.readFileSync(path.join(root, "firebase.json"), "utf8")).toBe(base);
    expect(fs.readFileSync(path.join(root, "out", "index.html"), "utf8")).toBe("fresh root");
  });
  it.each(["product-assets/main.js", "api/demo/fixtures/index.html", "how-it-works/index.html", "pricing.html", "index.htm", "index.rsc", "__next.unrecognized.txt"])("fails before changes when an export collision exists: %s", file => {
    const root = fixture(); fs.writeFileSync(path.join(root, "config", "hosting-mode.json"), product);
    const target = path.join(root, "out", file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, "unexpected");
    const before = files(root), config = fs.readFileSync(path.join(root, "firebase.json"), "utf8");
    expect(() => assembleHostingExport(root)).toThrow();
    expect(files(root)).toEqual(before); expect(fs.readFileSync(path.join(root, "firebase.json"), "utf8")).toBe(config);
  });
  it("rejects missing overview or invalid mode before deleting a root file", () => {
    const root = fixture(); fs.writeFileSync(path.join(root, "config", "hosting-mode.json"), product);
    fs.unlinkSync(path.join(root, "out", "benchmark", "index.html"));
    const before = files(root);
    expect(() => assembleHostingExport(root)).toThrow("Invalid benchmark export"); expect(files(root)).toEqual(before);
    fs.writeFileSync(path.join(root, "config", "hosting-mode.json"), product.replace("example-site", "INVALID"));
    expect(() => assembleHostingExport(root)).toThrow("Invalid hosting mode"); expect(files(root)).toEqual(before);
  });
  it.each(["config", "out"])("rejects a redirected %s directory before changing output", name => {
    const root = fixture(); fs.writeFileSync(path.join(root, "config", "hosting-mode.json"), product);
    const before = files(root), original = path.join(root, name), moved = path.join(root, `${name}-original`);
    fs.renameSync(original, moved); fs.symlinkSync(moved, original, "junction");
    try {
      expect(() => assembleHostingExport(root)).toThrow();
      expect(files(root)).toEqual(before); expect(fs.readFileSync(path.join(root, "firebase.json"), "utf8")).toBe(base);
    } finally { fs.unlinkSync(original); fs.renameSync(moved, original); }
  });
  it("rejects absent mode configuration without inferring a default", () => {
    const root = fixture(), before = files(root); fs.unlinkSync(path.join(root, "config", "hosting-mode.json"));
    expect(() => assembleHostingExport(root)).toThrow();
    expect(files(root)).toEqual(before); expect(fs.readFileSync(path.join(root, "firebase.json"), "utf8")).toBe(base);
  });
  it("makes every ordinary publisher use the same validation/export/assembly build", () => {
    const commands = JSON.parse(fs.readFileSync("package.json", "utf8")).scripts;
    expect(commands.build).toBe("node --import tsx scripts/assemble-hosting.ts --validate && node --import tsx scripts/prepare-export.ts && next build && node --import tsx scripts/assemble-hosting.ts");
    expect(commands["build:ci"]).toBe(commands.build);
    for (const name of ["results-sync", "predict-scheduler"]) expect(fs.readFileSync(`.github/workflows/${name}.yml`, "utf8")).toContain("run: npm run build");
  });
});

describe("subpage export assembly", () => {
  it("routes only the explicit application namespace and preserves every exported byte", () => {
    const root = fixture(), before = files(root);
    fs.writeFileSync(path.join(root, "config", "hosting-mode.json"), subpage);
    assembleHostingExport(root);
    expect(files(root)).toEqual(before);
    const configuration = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
    expect(configuration.hosting.rewrites).toEqual([
      { source: "/app", run: { serviceId: "example-app", region: "europe-west1" } },
      { source: "/app/**", run: { serviceId: "example-app", region: "europe-west1" } },
    ]);
    expect(configuration.firestore).toEqual(JSON.parse(base).firestore);
    expect(configuration.hosting.public).toBe("out");
    expect(configuration.hosting.trailingSlash).toBe(true);
    expect(configuration.hosting.ignore).toEqual(JSON.parse(base).hosting.ignore);
    fs.writeFileSync(path.join(root, "config", "hosting-mode.json"), benchmark);
    assembleHostingExport(root);
    expect(files(root)).toEqual(before);
    expect(fs.readFileSync(path.join(root, "firebase.json"), "utf8")).toBe(base);
  });

  it.each(["app", "app/index.html", "app/nested/index.txt", "app.html", "app.htm", "app.txt", "app.rsc", "app.unrecognized.txt"])("rejects static precedence collisions before any writes: %s", file => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "config", "hosting-mode.json"), subpage);
    const target = path.join(root, "out", file);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, "collision");
    const before = files(root), configuration = fs.readFileSync(path.join(root, "firebase.json"), "utf8");
    expect(() => assembleHostingExport(root)).toThrow("Conflicting hosting export");
    expect(files(root)).toEqual(before);
    expect(fs.readFileSync(path.join(root, "firebase.json"), "utf8")).toBe(configuration);
  });

  it("rejects even an empty application directory but retains similarly named benchmark content", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "config", "hosting-mode.json"), subpage);
    for (const file of ["application.html", "appx.txt", "__next.unrecognized.txt", "index.rsc"]) fs.writeFileSync(path.join(root, "out", file), file);
    const before = files(root);
    assembleHostingExport(root);
    expect(files(root)).toEqual(before);
    fs.mkdirSync(path.join(root, "out", "app"));
    const configuration = fs.readFileSync(path.join(root, "firebase.json"), "utf8");
    expect(() => assembleHostingExport(root)).toThrow("Conflicting hosting export");
    expect(files(root)).toEqual(before);
    expect(fs.readFileSync(path.join(root, "firebase.json"), "utf8")).toBe(configuration);
  });

  it.each([undefined, "example-project.firebaseapp.com", "auth.example.com"])("isolates benchmark policies from application headers with authDomain %s", authDomain => {
    const input = JSON.parse(subpage);
    if (authDomain !== undefined) input.authDomain = authDomain;
    const configuration = JSON.parse(renderHostingConfiguration(base, parseHostingMode(JSON.stringify(input))));
    const original = JSON.parse(base).hosting.headers;
    expect(configuration.hosting.headers.slice(0, original.length)).toEqual(original.map((entry: { source: string }) =>
      entry.source === "**" ? { ...entry, source: "!/app{,/**}" } : entry));
    expect(configuration.hosting.headers.filter((entry: { source: string }) => entry.source === "**")).toEqual([]);
    for (const source of ["/app", "/app/**"]) {
      const headers = configuration.hosting.headers.find((entry: { source: string }) => entry.source === source).headers;
      expect(headers).toContainEqual({ key: "Cache-Control", value: "no-store" });
      expect(headers).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" });
      expect(headers).toContainEqual({ key: "X-Content-Type-Options", value: "nosniff" });
      expect(headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
      expect(headers).toContainEqual({ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" });
      expect(headers).toContainEqual({ key: "Cross-Origin-Opener-Policy", value: authDomain ? "same-origin-allow-popups" : "same-origin" });
      const policy = headers.find((entry: { key: string }) => entry.key === "Content-Security-Policy").value;
      expect(policy).toBe(authDomain
        ? `default-src 'none'; script-src 'self' https://apis.google.com; style-src 'self'; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://${authDomain}; frame-src https://${authDomain}; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`
        : "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
      expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|\*/u);
    }
  });

  it.each([
    subpage.replace("punditbench-hosting.v2", "punditbench-hosting.v1"),
    subpage.replace('"subpage"', '"product"'),
    subpage.replace('"subpage"', '"benchmark"'),
    subpage.replace('"example-app"', '"https://example.com"'),
    subpage.replace('"europe-west1"', '"unknown"'),
    subpage.replace('"mode":"subpage"', '"mode":"subpage","path":"/"'),
    subpage.replace('"mode":"subpage"', '"mode":"subpage","mode":"subpage"'),
    subpage.replace('"mode"', '"m\\u006fde"'),
    ...["", "https://auth.example.com", "auth.example.com:443", "auth.example.com/path", "auth.example.com; script-src *", "*.example.com", "AUTH.example.com", "localhost", "127.0.0.1", "[::1]", "example.com.", "-auth.example.com", "auth..example.com", "a".repeat(64) + ".example.com", "a.".repeat(125) + "example.com", null, true].map(authDomain => JSON.stringify({ ...JSON.parse(subpage), authDomain })),
  ])("rejects incompatible schema and unsafe configuration: %s", value => {
    expect(() => parseHostingMode(value)).toThrow("Invalid hosting mode");
  });

  it("does not add authDomain support to either v1 mode", () => {
    for (const value of [benchmark, product]) expect(() => parseHostingMode(JSON.stringify({ ...JSON.parse(value), authDomain: "auth.example.com" }))).toThrow("Invalid hosting mode");
  });
});
