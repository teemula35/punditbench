# PunditBench changelog

Material events affecting scoring, data, or methodology are recorded here (C13/E-transparency).

## 2026-06-11 (all before the opening kickoff, 19:00 UTC)

- **Methodology v2 — self-consistent bracket simulation.** Knockout predictions are no longer collected round-by-round against real pairings; instead every model's own group predictions determine its own bracket, which it predicted through to its own champion. All collected pre-kickoff. Scoring extended with bracket components (advancement, matchup hits, matched-pairing scorelines) — see METHODOLOGY.md.
- **Third-place allocation:** FIFA Annexe C lookup (495 combinations) parsed from the official regulations and machine-validated; used for all simulated brackets (`data/third-allocation.json`, ALLOCATION-NOTES.md).
- **Roster expanded 18 → 34 → 33:** 16 models added (live-catalog-verified); OLMo-3 removed — listed in the catalog but no provider serves it (HTTP 404 on every attempt, logged in raw/group).
- **Validator relaxed (applies identically to all):** entries for unlisted match numbers are now dropped with a logged warning instead of failing the response. Reason: Phi-4 Mini and LFM-2 predicted past the listed fixtures into the knockout bracket; rejecting that measures formatting, not football. All previously-passing models unaffected. Both models passed on rerun.
- Group-stage hashes: 18-model set `9a7d3581…408fbc` (tag `predictions-group`), expanded 33-model set `4afa1910…d3d83d` (tag `predictions-group-v2`). Full-tournament hash tagged after simulation completes.
- **Final pre-kickoff roster cut (operator decision): 44 → 40.** Four small models — Granite 4.1 8B, LFM-2 24B, Phi-4 Mini, Llama 3.2 1B — failed a fourth retry cycle with byte-identical errors and were removed from the ranked roster entirely rather than carried as zero/partial entries. Their raw attempts stay published in `data/raw/` (the small-model capability floor remains documented in ROSTER-NOTES.md). Every ranked model now carries a complete tournament: **40 models, 19 vendors, 40/40 full brackets.** Final hash tagged `predictions-full-tournament-v4`.
- **Pre-kickoff retry round (user-requested):** the five models without complete brackets each got a fresh attempt. Hunyuan A13B succeeded on rerouted serving (OpenRouter provider variance) and now carries a full bracket — 40/44 complete; Granite 4.1 (partial through R16), LFM-2, Phi-4 Mini and Llama 3.2 1B reproduced their failures exactly and are final per the failure policy. Updated full-tournament hash tagged `predictions-full-tournament-v3`. Site copy corrected: failed simulations are stated as final, not "being collected".
- **Roster expanded 33 → 44 (still pre-kickoff):** a legacy wing (GPT-3.5 Turbo, GPT-4, GPT-4o, Claude 3 Haiku, Llama 3 70B, Gemma 2 27B, Qwen 2.5 72B) and an oddball wing (WizardLM-2 8x22B, Hermes 3 405B, Hunyuan A13B, Llama 3.2 1B; Mercury 2 and LFM-2 retagged oddball). All candidates live-pinged before joining. Inflection dropped: both its endpoints return empty content (raw logs kept). Llama 3.2 1B failed the group-stage format in all attempts (stops near match 48) and stands as a disclosed zero entry. Final ranked roster: **44 models, 21 vendors**. Updated full-tournament hash tagged `predictions-full-tournament-v2`.

## 2026-06-10

- Project created. Methodology v1 fixed (see METHODOLOGY.md), scoring rules D1, prompt template v1.
- Fixture dataset built from Wikipedia (two independent extraction passes) and cross-verified against ESPN, Sky Sports, FOX Sports and roadtrips.com official match numbering; all 72 group fixtures agreed across sources.
- Roster of 18 models across 10 vendors verified against the live OpenRouter catalog (`data/roster.json`).
