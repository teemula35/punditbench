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
service, collect predictions, write results or deploy. Acceptance covers both assembly
modes, default byte preservation, exact routing boundaries, root precedence, configuration
failure and retained benchmark/deep-link/download content.
