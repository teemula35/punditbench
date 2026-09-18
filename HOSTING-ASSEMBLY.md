# Hosting assembly

The public export preserves all existing benchmark routes and downloads. A benchmark
overview is also available at `/benchmark/`, including `#archive` and
`#world-cup-archive`. Existing evidence and prediction tags do not move.

`config/hosting-mode.json` selects one explicit versioned assembly mode. The committed
mode is **benchmark**: the existing root homepage and hosting behavior remain active.
Adding the alternative assembly does not switch traffic or deploy anything.

- `benchmark` preserves the static root and emits the unchanged base hosting configuration.
- `product` requires an explicit Cloud Run service ID and supported region. It forwards
  only the root, explanation/pricing pages, the separate product asset namespace and
  anonymous demo API. Customer APIs and benchmark paths are never forwarded by this assembly.
- `subpage` uses schema v2 and forwards only `/app` and `/app/**` to an explicitly
  configured Cloud Run service. It preserves the complete static benchmark, including
  the root homepage, root RSC payloads, downloads and evidence.
- Missing, malformed or contradictory configuration fails before export mutation. There
  is no environment-based mode or target fallback. Changing the committed mode requires
  an independently reviewed hosting change and deployment.

Both ordinary build commands validate configuration before preparing public downloads,
run the static export, and assemble `firebase.json` from `config/firebase-base.json`.
The existing result and prediction publishers already use `npm run build`; their deployment
steps continue to consume `firebase.json`. Manual publishing uses the same completed build.
No hosted-service source or browser bundle is copied into this repository or export.

The default configuration is:

```json
{ "schema": "punditbench-hosting.v1", "mode": "benchmark" }
```

The alternative schema requires `mode: "product"` and a `target` object containing
`serviceId` and `region`. The service ID is an unqualified Cloud Run name, not a URL;
the region must be supported by Firebase Hosting's Cloud Run integration. Unknown,
duplicate or escaped fields are rejected. There is no default target. The base file
contains no redirects or rewrites; the assembler owns the narrow rewrite list.

The exact forwarded sources are `/`, `/how-it-works`, `/how-it-works/`, `/pricing`,
`/pricing/`, `/product-assets/**` and `/api/demo/**`. These sources receive no-store,
no-referrer and a same-origin content security policy. There is no catch-all or customer
API forwarding. Existing static files or directories occupying these routes are rejected.

In product mode, generated static root HTML and root RSC payloads are removed only after
the complete benchmark export is present and collisions have been rejected. Other routes,
downloads, images and shared benchmark assets remain. A fresh benchmark-mode build restores
the static root. Navigation that can cross between the benchmark renderer and the root uses
ordinary document navigation, avoiding a cached benchmark client render at the root.

The known root representations are `index.html`, `index.txt`, `__next._full.txt`,
`__next._tree.txt` and `__next.__PAGE__.txt`. An unfamiliar `index.*` or `__next.*` root
artifact fails product assembly so a framework upgrade cannot silently leave stale root
content. Shared `_next/` assets, `robots.txt`, sitemap/feed files and images are preserved.
Redirected configuration or export directories are rejected. Switching back must run a
fresh build: reassembling an already stripped product export is insufficient.

Use `node --import tsx scripts/assemble-hosting.ts --validate` for configuration validation
alone. Use the ordinary build for a complete non-deploying export; `next build` alone skips
assembly. Review `config/firebase-base.json` when changing hosting settings. In benchmark
mode the assembled `firebase.json` is byte-identical to that base file.

This follows Firebase's documented [response priority](https://firebase.google.com/docs/hosting/full-config#hosting_priority_order):
static files precede rewrites. [Cloud Run rewrites](https://firebase.google.com/docs/hosting/cloud-run)
preserve the incoming path and do not inherit static trailing-slash redirects. Deployment
must separately verify the configured service, response headers and archive anchor behavior.

Tests use synthetic service identifiers and disposable exports; they do not contact a
service, collect predictions, write results or deploy. Acceptance covers all assembly
modes, default byte preservation, exact routing boundaries, root precedence, configuration
failure and retained benchmark/deep-link/download content.

## Application subpage

The additional mode is explicit and does not change either v1 mode:

```json
{
  "schema": "punditbench-hosting.v2",
  "mode": "subpage",
  "target": { "serviceId": "example-app", "region": "europe-west1" }
}
```

The complete rewrite list is `/app` followed by `/app/**`. There is no root rewrite,
catch-all, or API route outside this namespace. Firebase forwards the incoming path;
the destination service must support the `/app` mount, including its browser links,
assets and API requests. Similarly named paths such as `/application` and `/appx`
are outside the mount. Hosting's reserved `/__/` paths are not changed.

Every export byte remains intact. An `app` file or directory, even empty, or any
root `app.*` representation causes assembly to fail before any write. This catches
static content that would take priority over a rewrite and unexpected framework
representations. No conflicting file is removed automatically. Returning to benchmark
mode restores the base configuration without needing to recreate stripped files.

In subpage mode only, the benchmark's global `**` header rule becomes `!/app{,/**}`.
Firebase documents [negative globs and path braces](https://firebase.google.com/docs/hosting/full-config#rewrites)
and [header matching before rewrites](https://firebase.google.com/docs/hosting/full-config#headers).
The application receives its own no-store, no-referrer, nosniff, frame-denial,
permissions, CSP and COOP headers. Its default CSP permits same-origin resources
only, without inline-script exceptions; COOP is `same-origin`. Benchmark header
values and the static asset/download rules remain unchanged. This avoids relying
on overlapping benchmark and application CSP or COOP headers being overwritten.

An optional top-level `authDomain`, for example `example-project.firebaseapp.com`,
selects the Firebase Google popup policy. It must be an explicit lowercase DNS
hostname, with no scheme, port, path, wildcard or IP address. This is public browser
configuration, not a credential. It does not configure or enable authentication.
The selected Firebase project, enabled Google provider, authorized origin and chosen
auth domain must be verified separately, as described in the
[Firebase Google sign-in documentation](https://firebase.google.com/docs/auth/web/google-signin).

With `authDomain`, the application CSP additionally permits scripts from
`https://apis.google.com`, connections to `https://identitytoolkit.googleapis.com`,
`https://securetoken.googleapis.com` and the exact HTTPS auth domain, and frames from
that exact domain. It allows no wildcard, inline or eval source. COOP becomes
`same-origin-allow-popups` for popup communication; see Google's
[popup COOP guidance](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid#cross_origin_opener_policy).
This policy is for a bundled Firebase Authentication client; it does not permit
the separately hosted Google Identity Services or Firebase CDN SDKs. A service with
different resource needs requires a separately reviewed policy change.

Before activation, verify the destination service and same-origin browser behavior,
the assembled rewrites and headers, preserved benchmark/evidence routes, and an
authenticated flow if configured. Adding this assembler does not make those live
checks pass or change the committed benchmark configuration.
