# PunditBench — trust & security audit notes

Audited live on **2026-06-11** against `https://punditbench.com` and `https://punditbench.web.app` (read-only; nothing changed except this file).

## Verdict

**Does the site look risky today? No — not to browsers or to users.** TLS is a valid, auto-renewing Google-managed certificate (same class of cert google.com itself uses), there is no mixed content, no malware/phishing flags, no third-party junk, and the page carries unusually good good-faith signals (public GitHub repo, methodology page, disclaimers, consent banner, cookieless counter). **There is nothing to buy.** Paid / EV / OV certificates have shown *no* special browser UI since 2019 (Chrome 77 / Firefox 70 removed the green bar); "trust seals" are decorative images that no filter consults.

Two honest caveats:

1. **Corporate filters, not humans:** the domain is hours old, so secure web gateways (Zscaler, Palo Alto, Cisco Umbrella, FortiGuard) and Outlook SafeLinks may classify it "newly registered / uncategorized" for roughly 1–32 days. That is true of every new domain and fixes itself with time; categorization submissions (below) speed it up.
2. **Header-scanner optics:** securityheaders.com would currently grade ~**D** (only HSTS present). Purely cosmetic for a static site, but the fix is a 10-line firebase.json paste (below) and lifts it to **B**, or **A** once the CSP is flipped from Report-Only to enforcing.

---

## 1. TLS — pass, nothing to do

| Item | Observed |
|---|---|
| Certificate | `CN=punditbench.com`, issuer **Google Trust Services WR3**, chain WR3 → GTS Root R1, chain validates |
| Validity | 2026-06-11 → 2026-09-09 (~90-day Google-managed cert, auto-renews; no action ever needed) |
| Protocol | **TLS 1.3** negotiated |
| `http://punditbench.com` | `301 → https://punditbench.com/` ✔ |
| `http://www.` / `https://www.` | `301 → https://www.` → `301 → https://punditbench.com/` (www has its own valid cert) ✔ |
| HSTS | `max-age=31556926` sent automatically by Firebase on the custom domain; web.app carries `includeSubDomains; preload` (all of `*.web.app` is browser-preloaded) |

A DV cert from Google Trust Services is *exactly* what the modern web runs on. Browsers render the identical padlock for DV, OV and EV. **Do not buy a certificate.**

## 2. Security headers — only HSTS present today

Both domains serve the same set on `/`:

| Header | punditbench.com | Worth adding? |
|---|---|---|
| Strict-Transport-Security | ✔ `max-age=31556926` (Firebase default) | Already fine. Skip HSTS-preload submission — irreversible, no gain here. |
| X-Content-Type-Options | ✘ | Yes — `nosniff`, zero risk, free scanner points. |
| X-Frame-Options / frame-ancestors | ✘ | Yes — site is never framed; `DENY` stops clickjacking framing. Zero risk. |
| Referrer-Policy | ✘ | Yes — `strict-origin-when-cross-origin` (locks in the browser default explicitly). Zero risk. |
| Permissions-Policy | ✘ | Yes — site uses no camera/mic/geo; declaring it is pure scanner candy. Zero risk. |
| Content-Security-Policy | ✘ | Yes, with eyes open — see below. |

**Scanner grades:** today ≈ **D** on securityheaders.com and ≈ 50/100 (**D-**) on MDN HTTP Observatory (<https://developer.mozilla.org/en-US/observatory>). With the no-risk set (no CSP) ≈ **B** / ~75. With an enforcing CSP ≈ **A** / ~80 (the unavoidable `'unsafe-inline'` costs the A+).

**CSP reality check for this stack:** Next.js static export means inline hydration scripts (`self.__next_f.push` — 60 of them on the homepage) with hashes that churn every build, and firebase.json headers are static — so nonces/hashes are impossible and `script-src` must include `'unsafe-inline'`. That demotes the CSP from "XSS-proof" to "origin allowlist": it still blocks any injected *external* script and limits where data can be sent, which is real value, and on a no-user-input static site the XSS surface is ~nil anyway. The CSP below allows everything the site actually does: inline Next.js scripts, Tailwind/inline styles, the consent-gated `www.googletagmanager.com/gtag/js`, GA4 collect endpoints (Google's documented gtag.js CSP set — ads endpoints not needed since `ad_storage` is permanently denied), and the Firestore REST counter. It ships as **Content-Security-Policy-Report-Only**, which *cannot break anything by definition* — browse the site with analytics accepted, watch the console for violations for a day, then rename the key to `Content-Security-Policy`.

### Ready-to-paste `hosting.headers` for firebase.json (replaces the current array; first two blocks are the existing ones)

```json
"headers": [
  {
    "source": "/_next/static/**",
    "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
  },
  {
    "source": "/data/**",
    "headers": [
      { "key": "Cache-Control", "value": "public, max-age=300" },
      { "key": "Access-Control-Allow-Origin", "value": "*" }
    ]
  },
  {
    "source": "**",
    "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
      { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
      {
        "key": "Content-Security-Policy-Report-Only",
        "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.google-analytics.com https://*.googletagmanager.com; connect-src 'self' https://firestore.googleapis.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
      }
    ]
  }
]
```

Notes: `X-Frame-Options: DENY` enforces framing protection immediately while the CSP trials in Report-Only. Don't add `Cross-Origin-Embedder-Policy` — it would break the cross-origin gtag script. Don't duplicate HSTS — Firebase already sends one and browsers honor only the first.

## 3. Google Safe Browsing — not flagged

The transparency-report UI is JS-walled, but its JSON API answered directly:

```
punditbench.com  → ["sb.ssr", 6, false ×5, lastChecked=0]      (no flags; never evaluated yet)
google.com       → ["sb.ssr", 4, false ×5, lastChecked=<ts>]   (checked, clean)
testsafebrowsing.appspot.com → ["sb.ssr", 3, true,true,true,…] (flagged unsafe)
```

So PunditBench is **not flagged**; status is "no data yet", the normal state for a day-old domain, which becomes "no unsafe content found" once Google crawls it (Search Console verification + sitemap submission speeds that up; sitemap already exists and is valid). Manual check for the owner: <https://transparencyreport.google.com/safebrowsing/search?url=punditbench.com>

## 4. Link-preview trust — good text, image still missing (pass in flight)

Deployed today: `og:title`, `og:description`, `og:url`, `og:site_name`, `og:locale`, `og:type`, `twitter:card=summary`, `twitter:title`, `twitter:description`. **Missing: `og:image` and `twitter:image`** — without them, LinkedIn/Slack/iMessage previews render text-only, which reads "low-effort" rather than "risky". The parallel OG-image pass should: use an absolute `https://punditbench.com/...` image URL ~1200×630, switch `twitter:card` to `summary_large_image`, and fix the **"33 LLMs" (title) vs "40 LLMs" (description) mismatch** — small, but exactly the kind of sloppiness a wary reader notices. After deploying, force re-scrapes: LinkedIn Post Inspector <https://www.linkedin.com/post-inspector/> and Facebook Sharing Debugger <https://developers.facebook.com/tools/debug/>.

## 5. New-domain reputation (registered 2026-06-11, Namecheap)

**Who gets suspicious of day-old domains:** corporate proxies/SWGs — Palo Alto "newly-registered-domain" category (~32 days), Zscaler NRD, Cisco Umbrella "newly seen domains", FortiGuard NRD; Microsoft 365 Outlook SafeLinks (time-of-click "this link might be unsafe" interstitials); email spam filters (Spamhaus ZRD lists domains for their first ~24h — sharing by email is the most likely place to see friction); consumer AV ratings showing "untested/unproven" (Norton Safe Web, McAfee WebAdvisor). Plain browsers apply **no** new-domain penalty.

**What actually helps:** time (most NRD windows expire within 24h–32 days); serving the same legitimate content from day one on Google infrastructure with valid TLS; no redirects off-domain (verified: every URL in HTML/sitemap is same-origin, the only external link is the public GitHub repo); the existing about/methodology pages; Search Console + sitemap; and free categorization requests:

- McAfee/Skyhigh TrustedSource: <https://sitelookup.mcafee.com/>
- Netcraft site report (gets it crawled/rated): <https://sitereport.netcraft.com/?url=https://punditbench.com>
- Bitdefender (URL submission/false-positive portal): <https://www.bitdefender.com/submit/>
- Broadcom/Symantec Site Review (feeds many enterprise proxies): <https://sitereview.bluecoat.com/>
- Palo Alto URL filtering: <https://urlfiltering.paloaltonetworks.com/> · Zscaler: <https://sitereview.zscaler.com/> · FortiGuard: <https://www.fortiguard.com/webfilter>
- Norton Safe Web: <https://safeweb.norton.com/> · Cisco Talos: <https://talosintelligence.com/reputation_center>

**What does NOT help:** buying EV/OV certificates (no browser UI since 2019, ignored by filters), "trust seal" badges, WHOIS-privacy toggling, paid "reputation boosting".

## 6. Misc smells — clean

- **Mixed content:** none — zero `http://` references in served HTML.
- **Scripts:** all `<script src>` are same-origin `/_next/static/...`; the 60 inline scripts are standard Next.js App Router flight data (every Next site has them; scanners don't flag this). No `eval(`, no obfuscated blobs. Only external origins in the entire JS bundle: `www.googletagmanager.com` (injected only after consent Accept) and `firestore.googleapis.com` (REST counter).
- **GitHub link:** <https://github.com/teemula35/punditbench> returns 200 and is public — a positive signal, matching the "SHA-256 pre-registered in the public repository" claim on /about/.
- **Visible Firebase API key in JS:** by design — Firebase web API keys are public identifiers, not secrets; protection lives in `firestore.rules`, which are tight (counters world-readable, the only public write is exactly "+1", delete denied, everything else locked).
- **Hygiene:** robots.txt + valid same-origin sitemap; unknown paths return real HTTP 404 with `noindex`; no iframes, no forms, no third-party fonts/CDNs; footer carries "not betting advice / AI-generated content / not affiliated with FIFA" disclaimers and an "Analytics settings" consent re-opener.

---

## Prioritized actions

**Implement now (assistant):**
1. Paste the headers block above into firebase.json and deploy; verify at <https://securityheaders.com> and <https://developer.mozilla.org/en-US/observatory>.
2. Land the OG-image pass: absolute `og:image`/`twitter:image`, `summary_large_image`, fix the 33-vs-40 copy mismatch; after deploy, re-scrape via LinkedIn Post Inspector + Facebook Sharing Debugger.
3. After ~a day of clean console under Report-Only (browse with analytics accepted), rename `Content-Security-Policy-Report-Only` → `Content-Security-Policy`. If anything is blocked it will be a GA endpoint variant — add the reported host to `connect-src` or stay on the no-CSP set (already a B; perfectly defensible for a static site).

**Owner, optional, ~15 minutes total:**
4. Verify the domain in Google Search Console and submit the sitemap (speeds Google's "no data" → "no unsafe content found").
5. Submit categorization to Bluecoat, Palo Alto, Zscaler, FortiGuard and McAfee (the ones behind corporate blocks); Netcraft/Norton/Bitdefender if keen.

**Ignore (waste of money/effort):**
- Paid, OV or EV certificates; trust-seal badges; HSTS preload submission; COEP; any paid "site reputation" service. Time + the steps above are the entire fix.
