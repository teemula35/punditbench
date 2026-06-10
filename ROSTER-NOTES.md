# Benchmark Roster Notes — 2026 World Cup Prediction

Selected 2026-06-10 from a live pull of `https://openrouter.ai/api/v1/models` (338 models). Every ID below was verified to exist in that catalog; nothing is from memory. Machine-readable roster: `data/roster.json`.

## Roster (18 models, 10 vendors)

| OpenRouter ID | Vendor | Tier | Ctx | $/M in | $/M out | Cutoff | Reasoning | Est. cost (6 runs) |
|---|---|---|---:|---:|---:|---|---|---:|
| `openai/gpt-5.5` | OpenAI | flagship | 1.05M | 5.00 | 30.00 | 2025-12 | yes | $1.59 |
| `openai/gpt-5.4-mini` | OpenAI | small | 400K | 0.75 | 4.50 | 2025-08 | yes | $0.24 |
| `anthropic/claude-fable-5` | Anthropic | flagship | 1M | 10.00 | 50.00 | unknown | yes | $2.70 |
| `anthropic/claude-haiku-4.5` | Anthropic | small | 200K | 1.00 | 5.00 | 2025-02 | yes | $0.27 |
| `google/gemini-3.1-pro-preview` | Google | flagship | 1.05M | 2.00 | 12.00 | unknown | yes | $0.64 |
| `google/gemini-3.1-flash-lite` | Google | small | 1.05M | 0.25 | 1.50 | unknown | yes | $0.08 |
| `x-ai/grok-4.3` | xAI | flagship | 1M | 1.25 | 2.50 | unknown | yes | $0.16 |
| `deepseek/deepseek-v4-pro` | DeepSeek | flagship | 1.05M | 0.435 | 0.87 | unknown | yes | $0.05 |
| `deepseek/deepseek-v4-flash` | DeepSeek | small | 1.05M | 0.0983 | 0.1966 | unknown | yes | $0.01 |
| `meta-llama/llama-4-maverick` | Meta | flagship | 1.05M | 0.15 | 0.60 | 2024-08 | no | $0.03 |
| `meta-llama/llama-4-scout` | Meta | small | 10M | 0.10 | 0.30 | 2024-08 | no | $0.02 |
| `mistralai/mistral-medium-3-5` | Mistral | flagship | 262K | 1.50 | 7.50 | unknown | yes | $0.41 |
| `mistralai/mistral-small-2603` | Mistral | small | 262K | 0.15 | 0.60 | unknown | yes | $0.03 |
| `qwen/qwen3.7-max` | Alibaba | flagship | 1M | 1.25 | 3.75 | unknown | yes | $0.22 |
| `qwen/qwen3.6-flash` | Alibaba | small | 1M | 0.1875 | 1.125 | unknown | yes | $0.06 |
| `moonshotai/kimi-k2.6` | Moonshot | flagship | 262K | 0.68 | 3.41 | unknown | yes | $0.18 |
| `z-ai/glm-5.1` | Z.AI | flagship | 203K | 0.98 | 3.08 | unknown | yes | $0.18 |
| `z-ai/glm-4.7-flash` | Z.AI | small | 203K | 0.06 | 0.40 | unknown | yes | $0.02 |

## Cost estimate

Basis: 6 runs/model, ~5K prompt + ~8K completion tokens/run = 30K in + 48K out per model.

- **Total: ≈ $6.89** for all 18 models (flagships ≈ $6.16, smalls ≈ $0.73).
- The two expensive models dominate: Claude Fable 5 ($2.70) + GPT-5.5 ($1.59) = 62% of total.
- **Caveat:** 16/18 models are reasoning models; thinking tokens bill as output. If models reason heavily, real output could be 2–4x the 8K assumption — budget **~$10–25** to be safe. Capping via `max_tokens`/reasoning-effort params would constrain this.

## Why 18 and not ~14

Step-2 rules ("flagship + small per vendor") over 9 mandatory vendors + optional Z.AI yield 20 slots, minus 2 vendors with **no small model on OpenRouter** (xAI, Moonshot) = 18. To trim toward 14: drop the Z.AI pair (16), then drop Meta's stale non-reasoning pair (14).

## Considered and rejected

| Model | Reason rejected |
|---|---|
| `openai/gpt-5.5-pro` ($30/$180) | Specialized high-compute "pro" tier, ~6x flagship cost; gpt-5.5 is the standard frontier model |
| `openai/gpt-chat-latest`, `~openai/gpt-latest`, `~openai/gpt-mini-latest`, `~anthropic/claude-*-latest`, `~google/gemini-*-latest`, `~moonshotai/kimi-latest` | Auto-updating aliases — model can change underneath mid-benchmark; pinned IDs preferred |
| `openai/gpt-5.4-nano` ($0.20/$1.25) | Kept mini as the canonical small tier; nano noted as a budget alternative |
| `openai/gpt-5.3-codex`, `gpt-5.2-codex` | Code-specialized variants |
| `anthropic/claude-opus-4.8` | Strong, but Fable 5 is Anthropic's current flagship (GA 2026-06-09, "new tier above Opus") |
| `anthropic/claude-*-fast` variants | Latency-optimized premium-priced serving variants |
| `google/gemini-3.5-flash` | Newest stable Google model but mid-tier: neither flagship nor cheap ($1.50/$9) |
| `google/gemini-2.5-pro` | Stable but a year old; 3.1 Pro Preview is the actual current flagship |
| `google/gemini-3.1-pro-preview-customtools`, `gemini-3.1-flash-lite-preview` | Specialized / preview duplicates of chosen models |
| `x-ai/grok-build-0.1` | App-building/coding-agent model, not a general small chat model |
| `x-ai/grok-4.20`, `grok-4.20-multi-agent` | Superseded by Grok 4.3; multi-agent variant is specialized |
| `deepseek/deepseek-v3.2`, `deepseek-r1-0528` | Superseded by the V4 family |
| `meta-llama/llama-3.3-70b-instruct` | Older generation; Scout is Meta's current small |
| `mistralai/mistral-large-2512` | "Large" branding, but older (2025-12), cheaper, non-reasoning; Medium 3.5 is Mistral's actual frontier by recency/price/reasoning — judgment call, documented |
| `mistralai/ministral-3b/8b/14b-2512` | Edge-tier; Mistral Small is the canonical small |
| `qwen/qwen3.7-plus` | Newer date (2026-06-03) but mid-tier below Max |
| `qwen/qwen3.6-max-preview`, `qwen3-max-thinking` | Preview / superseded by 3.7 Max |
| `qwen/qwen3.5-flash-02-23` | Cheaper but older flash generation than 3.6 Flash |
| `moonshotai/kimi-k2.5`, `kimi-k2-thinking` | Superseded by K2.6; all K2 variants are 1T-class (none qualify as "small") |
| `z-ai/glm-5-turbo` | Speed variant priced above GLM 5.1 |
| `z-ai/glm-4.5-air` | Older small; GLM 4.7 Flash is current |
| All `:free` variants | Heavy rate limits; unusable for a same-day benchmark run |

## Verification gaps / open issues

- **xAI:** no small/mini model in the catalog at all (only 4 x-ai models listed) — flagship only.
- **Moonshot:** no small model exists (K2 family only) — flagship only.
- **Google:** no *stable* Gemini 3.x Pro; `gemini-3.1-pro-preview` used since the only stable Pro (2.5) is a year old. Preview models can be deprecated on short notice.
- **Knowledge cutoffs:** OpenRouter's `knowledge_cutoff` field was null for 12/18 picks and vendor docs were only checked for Anthropic (per "easily found" rule) — marked `unknown`, not guessed. Relevant to this benchmark: Llama 4 (2024-08) and Haiku 4.5 (2025-02) predate WC qualification finals, so the prompt should supply fixtures/squad context rather than rely on model knowledge.
- **Temperature:** OpenAI GPT-5.x and Claude Fable 5 reject `temperature`/`top_p` (not in `supported_parameters`). The harness must omit sampling params for these (or globally) or those calls 400.
- **Fable 5 is one day old** at benchmark time — possible launch-day capacity/availability wobbles on OpenRouter.
