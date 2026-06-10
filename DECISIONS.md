# PunditBench — Decisions log

Decisions D1–D4, D6, D8 delegated to Claude on 2026-06-10; D5 adopted as default; D7 open (user).

## D1 — Scoring system ✅ 2026-06-10

Per match, scored against the result after 90 minutes + stoppage time:

| Outcome | Points |
|---|---|
| Exact score | **3** |
| Correct goal difference, not exact (includes any correct draw scoreline) | **2** |
| Correct outcome (win/draw/win) only | **1** |
| Otherwise / no valid prediction | **0** |

Knockout matches additionally: **+1** for correctly naming the team that advances (covers extra time and penalties). Knockout scorelines are scored against the 90-minute result — the standard convention in prediction games. Models must always provide `advances` in knockout predictions; when their predicted score isn't a draw it must equal their predicted winner (validated).

Max per group match: 3. Max per knockout match: 4. Theoretical max: 72×3 + 32×4 = **344 pts**.

Leaderboard tiebreakers, in order: total points → most exact scores → most matches with ≥1 pt → most correct advances → shared rank.

Voided/abandoned matches: 0 pts for everyone, excluded from all counts, noted in changelog.

## D2 — Model roster & parameters ✅ 2026-06-10

- ~14 models: current **flagship + one small/cheap model per major vendor** (OpenAI, Anthropic, Google, xAI, DeepSeek, Meta, Mistral, Alibaba/Qwen, Moonshot), IDs verified against the **live OpenRouter catalog** on run day — never from memory. Final list: `data/roster.json` + `ROSTER-NOTES.md`.
- Params: `temperature: 0` where the model accepts it (recorded per call; some reasoning models reject it → run at provider default and record that), single run (n=1), no system prompt, no tools, no `:online` variants.
- Knowledge cutoffs recorded per model (best effort from catalog/vendor docs) and displayed.
- Roster **frozen** after the group-stage run. Models added later (if ever) are unranked exhibition entries.

## D3 — API route ✅ 2026-06-10

OpenRouter chat-completions API as the single integration: one key, one bill, automatic fallback routing, every major vendor. Plain completions only — no plugins, no web search, no tools, so models predict from training knowledge only.

## D4 — Prompt & output format ✅ 2026-06-10

- One prompt per stage, **byte-identical for every model** (no model names inside). Template versioned (`v1`) in `lib/prompt.ts`, reproduced verbatim in METHODOLOGY.md.
- Group prompt: all 72 fixtures (official match number, group, teams, date, city) → strict JSON `{"predictions":[{"match":1,"home_goals":2,"away_goals":0},…]}`. The scoring rules are stated in the prompt (same information for all).
- Knockout prompts: the round's real pairings **plus a compact summary of actual tournament results so far** (final group tables + knockout scores) — every model gets identical context, mirroring a pundit updating mid-tournament. Predictions require `"advances"` per match.
- No squad lists, no injury news, no odds — training knowledge only.

## D5 — Failure policy ☑ default adopted (user may veto)

Up to 3 attempts per model per stage; attempts 2–3 append the validator's error report. Still invalid → the model scores 0 for the affected matches; the failure is disclosed on its model page. All attempts (including failures) are kept in the raw audit log. The golden integrity rule caps everything: nothing generated after a match's kickoff counts for that match.

## D6 — Name & domain ✅ 2026-06-10

**PunditBench** — punditbench.com (unregistered as of 2026-06-10, DNS-checked; user purchases). Rationale: pundit + benchmark says exactly what it is; no FIFA/World Cup trademark exposure; outlives this tournament (Champions League, Euro 2028…). Site references the "2026 FIFA World Cup" editorially only; no FIFA logos/emblems/mascots/typefaces anywhere. Runner-up names: Silicon Pundits (siliconpundits.com, also free), Bot Bracket (taken).

## D7 — Publishing entity ⛳ OPEN (user)

Personal vs Clarity AI Oy. Only blocks the imprint line on the legal page — placeholder until decided.

## D8 — Stack & architecture ✅ 2026-06-10 (revised from initial Cloud SQL sketch)

**Static-first, no database.**

- Data = versioned JSON files in the repo (`data/`): fixtures, teams, roster, predictions, results. **Git is the admin UI, the audit trail, and the backup.** Raw LLM request/response logs in `data/raw/` (JSONL).
- Scoring is always **derived at build time** from raw inputs — never stored, so it can't drift.
- Web: Next.js (App Router, TypeScript, Tailwind) with `output: "export"` → fully static site, CDN-native, survives any traffic spike at ~zero cost. All 104 match pages + model pages pre-rendered.
- Runner: TypeScript CLI (`scripts/predict.ts`) talking to OpenRouter directly; runs locally with `OPENROUTER_API_KEY` from `.env`.
- Updating results = `npm run result -- …` + git commit → CI rebuilds + redeploys the site.
- Deploy: GitHub Actions → Docker (nginx serving the export) → Cloud Run, activates once GCP project + secrets exist. The static export can equally go to Firebase Hosting/GitHub Pages if ever needed.
- Rationale: dataset is ~2 000 read-only rows updated a few times a day; a database adds failure modes, cost, and admin-auth surface for zero benefit. Revisit only if genuinely interactive features (accounts, user picks) are added later.
