# PunditBench changelog

Material events affecting scoring, data, or methodology are recorded here (C13/E-transparency).

## 2026-06-11 (all before the opening kickoff, 19:00 UTC)

- **Methodology v2 — self-consistent bracket simulation.** Knockout predictions are no longer collected round-by-round against real pairings; instead every model's own group predictions determine its own bracket, which it predicted through to its own champion. All collected pre-kickoff. Scoring extended with bracket components (advancement, matchup hits, matched-pairing scorelines) — see METHODOLOGY.md.
- **Third-place allocation:** FIFA Annexe C lookup (495 combinations) parsed from the official regulations and machine-validated; used for all simulated brackets (`data/third-allocation.json`, ALLOCATION-NOTES.md).
- **Roster expanded 18 → 34 → 33:** 16 models added (live-catalog-verified); OLMo-3 removed — listed in the catalog but no provider serves it (HTTP 404 on every attempt, logged in raw/group).
- **Validator relaxed (applies identically to all):** entries for unlisted match numbers are now dropped with a logged warning instead of failing the response. Reason: Phi-4 Mini and LFM-2 predicted past the listed fixtures into the knockout bracket; rejecting that measures formatting, not football. All previously-passing models unaffected. Both models passed on rerun.
- Group-stage hashes: 18-model set `9a7d3581…408fbc` (tag `predictions-group`), expanded 33-model set `4afa1910…d3d83d` (tag `predictions-group-v2`). Full-tournament hash tagged after simulation completes.

## 2026-06-10

- Project created. Methodology v1 fixed (see METHODOLOGY.md), scoring rules D1, prompt template v1.
- Fixture dataset built from Wikipedia (two independent extraction passes) and cross-verified against ESPN, Sky Sports, FOX Sports and roadtrips.com official match numbering; all 72 group fixtures agreed across sources.
- Roster of 18 models across 10 vendors verified against the live OpenRouter catalog (`data/roster.json`).
