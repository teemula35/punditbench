# Legal notes — LLM World Cup 2026 benchmark site

Research date: 2026-06-10. Scope: (1) do provider terms restrict PUBLISHING benchmark/comparison
results under the model's name; (2) programmatic source for WC 2026 results.
Context: all models accessed via OpenRouter; we publish predictions + scores only (no training on
outputs, so "no competing models" clauses are out of scope).

## Provider terms re: publishing benchmark results

| Vendor | Verdict | Note | Link |
|---|---|---|---|
| OpenAI | OK (verify manually) | No benchmark-publication clause found in current Terms of Use / Business Terms via secondary sources; only "no competing models" + a duty that published info about the services be accurate. openai.com blocks automated fetch (HTTP 403), so primary text not read directly — 5-min manual read recommended. | https://openai.com/policies/row-terms-of-use/ , https://openai.com/policies/may-2025-business-terms/ |
| Anthropic | OK | Commercial Terms (effective 2025-06-17): no clause restricting benchmark publication or performance comparisons. | https://www.anthropic.com/legal/commercial-terms |
| Google (Gemini API) | OK (caution if routed via Vertex) | Gemini API Additional Terms (updated 2026-03-23): no benchmark-publication restriction. BUT Google Cloud Service Specific Terms §7 "Benchmarking" allows public disclosure of benchmark tests of GCP services (incl. Vertex AI) only if (i) disclosure includes all info needed to replicate and (ii) reciprocity granted to Google. Relevant only if requests route through Vertex; that contract binds Google's direct customer (OpenRouter), not us. Mitigation: publish replicable methodology (we should anyway) and/or pin OpenRouter provider routing to "Google AI Studio". | https://ai.google.dev/gemini-api/terms , https://cloud.google.com/terms/service-terms |
| xAI | CAUTION | Enterprise Customer Agreement (GSA-approved, 2025-06-26; verified from PDF text) acceptable-use item (j): customer may not "use or permit the use of any tools in order to probe, scan or attempt to penetrate or benchmark any Services". Reads like a security/load-testing clause, but literally covers "benchmark". No clause restricting publication of results as such. Also: must not represent Output as human-generated (we label everything as AI predictions, so fine). Live x.ai terms pages block automated fetch — current consumer/enterprise ToS not re-verified. | https://x.ai/legal/terms-of-service-enterprise (live), verified text: https://fedscoop.com/wp-content/uploads/sites/5/2025/08/xAI-Enterprise-Customer-Agreement-GSA-Approved-6.26.25.pdf |
| Meta (Llama) | OK | Llama 4 Community License: no benchmark/publication restriction. "Built with Llama" naming and attribution duties apply to distributing the materials or building products on them — not to publishing evaluation results about a hosted model. Naming the model in a results table is nominative use. | https://github.com/meta-llama/llama-models/blob/main/models/llama4/LICENSE |
| Mistral | OK | Commercial Terms of Service (updated 2026-05-28): no benchmark/publication restriction; only vulnerability/pen-testing of the platform is prohibited (§2.2(f)). | https://legal.mistral.ai/terms/commercial-terms-of-service |
| DeepSeek | OK | Open Platform ToS (effective 2026-04-29) §4.2(3) expressly permits wide use of inputs/outputs incl. academic research. Duties: disclose outputs are AI-generated and may contain errors (§8.1) — we do; don't use DeepSeek marks to imply partnership (§5). | https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html |
| Alibaba / Qwen | OK (residual unclear) | Open-weight Qwen models: Apache-2.0, no restriction. Alibaba Cloud International product terms: no benchmark/disclosure clause found. qwen.ai ToS page is JS-rendered and could not be read by tooling — unread; flagged as unclear rather than researched further. | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-product-terms-of-service , https://qwen.ai/termsservice (unread) |
| Moonshot (Kimi) | OK | Kimi Open Platform ToS (updated 2026-05-27): no benchmark/publication restriction (only a no-competing-services clause, §3.2(5)). Moonshot even publishes its own "benchmark best practices" guide recommending the official API. | https://platform.moonshot.ai/docs/agreement/modeluse (redirects to platform.kimi.ai), https://platform.moonshot.ai/docs/guide/benchmark-best-practice |
| OpenRouter | OK (pass-through) | ToS (updated 2026-05-06): no own restriction on publishing benchmarks/outputs, but users must "comply with the applicable terms for each Model" — so the vendor caveats above flow through to us. | https://openrouter.ai/terms |

Cross-cutting hygiene (cheap, do regardless):
- Label all predictions clearly as AI-generated model outputs (hard requirement in DeepSeek and xAI terms; good practice everywhere).
- Use model names in plain text only (nominative use); no vendor logos, no implied endorsement or partnership.
- Publish methodology + prompts so results are replicable (also satisfies the Google Cloud §7 condition (i) if it ever applied).

## Results data source evaluation

### football-data.org
- FIFA World Cup is one of the 12 free-tier ("Tier One") competitions — free "forever" per coverage page. Competition id **2000**, code **WC** (confirmed in v4 docs lookup table). 2026 edition not explicitly named on the coverage page, but prior World Cups were served under this competition; verify id 2000 returns 2026 fixtures at kickoff (tournament starts 2026-06-11).
- Free tier: **10 calls/minute**, fixtures/results/standings with *delayed* scores (live scores are a €12/mo add-on). Delay is irrelevant to us — we score predictions after full time.
- Registration: free account signup (email) → API token sent; pass as `X-Auth-Token` header. No credit card.
- Endpoint sketch: `GET https://api.football-data.org/v4/competitions/2000/matches?season=2026`.
- Sources: https://www.football-data.org/coverage , https://www.football-data.org/pricing , https://docs.football-data.org/general/v4/lookup_tables.html

### API-Football (api-football.com / API-Sports)
- All plans include all competitions and endpoints; World Cup covered (they publish a dedicated "FIFA World Cup 2026 guide" article). Free plan: 100 requests/day, no credit card — **but free plans are limited in available seasons** (historically current season excluded), so the 2026 season likely requires a paid plan.
- Cheapest paid tier: **Pro, ~$19/month** (7,500 req/day). Pricing page blocks bots (HTTP 403) — confirm exact limits on signup.
- Sources: https://www.api-football.com/pricing , https://www.api-football.com/news/post/fifa-world-cup-2026-guide-to-using-data-with-api-sports

### openfootball (GitHub, free)
- `openfootball/worldcup.json` has a `2026/` directory (worldcup.json, groups, teams, stadiums) — public domain, no API key, fetch raw JSON from GitHub.
- Scores are maintainer-updated roughly **once a day** during tournaments (auto-regenerated via GitHub Action from curated text source). Fine for next-morning scoring and as an independent cross-check; not live.
- Source: https://github.com/openfootball/worldcup.json

### Verdict
- **Primary: football-data.org free tier.** Free, structured JSON, World Cup included, 10 req/min is far more than needed (104 matches; poll a few times per day). Owner action: register a free account at https://www.football-data.org/client/register and store the `X-Auth-Token` as a secret.
- **Fallback: openfootball/worldcup.json** (zero cost, no key, independent source — also useful to cross-validate scores before publishing standings).
- **Paid escape hatch if either fails: API-Football Pro ($19/mo)** — owner would create an account at api-football.com (API-Sports dashboard) only if needed.

## Open questions
1. xAI: does AUP item (j) ("...probe, scan or attempt to penetrate or benchmark any Services") cover capability comparisons published by an OpenRouter end-user, or only infra/load testing? Unclear; options: keep Grok with a footnote, ask xAI, or rely on OpenRouter being the direct customer. Live x.ai ToS pages couldn't be fetched for the current wording.
2. OpenAI: primary terms pages blocked automated fetch; verdict based on secondary sources — do a quick manual read of Terms of Use + Business Terms.
3. Gemini routing on OpenRouter: AI Studio vs Vertex — if Vertex, GCP §7 benchmarking clause (replicability + reciprocity) nominally applies to the chain; pinning to AI Studio routing sidesteps it.
4. Qwen: qwen.ai ToS page unreadable by tooling (JS-only) — unread, residual unknown.
5. football-data.org: confirm competition 2000 actually serves 2026 fixtures/results once the tournament starts (2026-06-11), and check the free-tier score delay in practice (expected fine for post-match scoring).
6. Not researched (out of scope per brief): FIFA's own rights in fixtures/results data — bare match results are facts and widely republished, but we did not verify jurisdiction-specific database rights.
