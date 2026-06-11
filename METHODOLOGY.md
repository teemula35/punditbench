# PunditBench Methodology — 2026 World Cup edition (v2)

PunditBench measures how well large language models predict real football. For the 2026 FIFA World Cup, every participating model predicts **its own complete tournament** — all 72 group matches and then, derived from its own predictions, its own knockout bracket through to its own champion — entirely **before the opening kickoff**. Reality then scores every claim. (PunditBench is an independent project, not affiliated with FIFA; tournament and team names are used editorially. All predictions shown are AI-generated content.)

> Methodology v1 (2026-06-10) collected group-stage predictions and planned to reveal real knockout pairings round by round. It was upgraded to v2 (self-consistent bracket simulation, below) on 2026-06-11, **before the opening match**; the group-stage collection is identical in both and was not re-run. See CHANGELOG.md.

## How predictions are collected

1. **Group stage.** Every model receives one identical prompt with all 72 group fixtures (official match numbers, teams, dates, venues) and returns a strict-JSON score for each. No tools, no web access, training knowledge only; `temperature: 0` where the model accepts it (recorded per call).
2. **Self-consistent knockout simulation.** From the model's own 72 scores we compute its group tables (FIFA tiebreakers: points, goal difference, goals scored, head-to-head) and its qualified third-placed teams, slot the thirds using **FIFA's official Annexe C lookup table** (all 495 combinations, parsed from the official regulations — see ALLOCATION-NOTES.md), and obtain the model's own Round of 32. The model is then prompted with *its own* bracket — explicitly framed as "the knockout bracket that follows from YOUR OWN predictions" — and predicts those 16 matches, naming the team that advances where it predicts a 90-minute draw. Its answers build its Round of 16, and so on through the quarter-finals, semi-finals, third-place match and final. Six prompts per model; every model ends with a full simulated tournament and a champion.
3. **Everything is locked pre-kickoff.** No prediction anywhere in the system depends on a single real result. The complete set (group + all simulated rounds, raw API traffic included) is hashed and pre-registered before the opening match.

## Scoring

**Group matches** (72 real matches, every model predicted all of them):

| Outcome | Points |
|---|---|
| Exact score | 3 |
| Correct goal difference (includes any correct draw) | 2 |
| Correct outcome (win/draw/loss) | 1 |

**Bracket (knockout) scoring**, against the real tournament as it unfolds:

| Component | Points |
|---|---|
| Real team you had reaching the Round of 32 | 1 each |
| … the Round of 16 | 2 each |
| … the quarter-finals | 3 each |
| … the semi-finals | 5 each |
| … the final | 8 each |
| Correct champion | 13 |
| Your simulated pairing actually occurs in that real round (incl. third-place match) | +1 each |
| Scoreline of a matched pairing, scored like a normal match (orientation-normalized, 90-minute result) | 3/2/1 (+1 correct advancer) |

A team "reaches" a stage by appearing in it; reach derives from the model's simulated pairings and its `advances` answers. Round-of-32 reach is determined entirely by the group predictions (computing the bracket needs no model input), so a model that failed its knockout prompts keeps the qualification credit its group answers locked in; everything beyond requires its own knockout answers. Three small models (Granite 4.1, LFM-2, Phi-4 Mini) could not produce fully valid knockout predictions within the retry policy and carry partial or no brackets; Llama 3.2 1B could not produce a valid group-stage set at all (it stops listing matches around number 48) and stands as a disclosed zero — where the small-model floor lies is itself a result. All disclosed on the model pages, raw attempts in the audit logs. Theoretical maximum: 216 (group) + 137 (advancement) + 32 (matchups) + 128 (matched scorelines) = **513**.

Leaderboard tiebreakers, in order: total points → most exact scores → correct champion → most correct Round-of-32 qualifiers → shared rank.

Voided/abandoned real matches score 0 for everyone and are excluded; documented in the changelog.

## Integrity rules

- **Kickoff cutoff (golden rule).** A prediction counts only if generated before the relevant information existed in reality — here, everything predates the opening kickoff (2026-06-11 19:00 UTC). Per-call timestamps are in the raw logs.
- **Pre-registration.** Canonical SHA-256 hashes of each locked prediction set are committed and tagged in the public repository before kickoff (`data/hashes/`, git tags). Anyone can recompute them from the published data.
- **Raw audit trail.** Every API request and response — including failed attempts and validator feedback — is published verbatim in `data/raw/`.
- **Frozen roster.** Fixed before the opening kickoff at 44 models (pre-kickoff expansions 18 → 33 → 44, every addition predicting under identical conditions before any match; two labs dropped because their catalog-listed endpoints served nothing — raw attempts in the audit logs). Later additions, if ever, would be unranked exhibition entries.
- **Identical treatment.** Same prompt templates, same parameters policy, same validator for every model. Knockout prompts are personalized **only** by the model's own previous answers — which is the design, not an asymmetry.
- **Derived scoring.** Points are recomputed from raw predictions + results on every site build and re-derivable from raw logs via `npm run audit`.

## Validation & failure policy

Responses must cover every listed fixture exactly once with integer goals 0–15; knockout predictions must name a consistent advancing team. Invalid responses get up to 2 corrective retries with the validator's errors appended; still-invalid means 0 points for the affected matches, disclosed on the model page. Entries for *unlisted* match numbers are dropped with a logged warning rather than failing the response (rule relaxed pre-kickoff on 2026-06-11 after two small models enthusiastically predicted matches beyond the fixture list; all earlier-passing models unaffected — see CHANGELOG.md).

## The roster

44 models across 21 vendors — current flagships, mid-tiers and small models, plus a **legacy wing** (2023–24 era: GPT-3.5 Turbo, GPT-4, GPT-4o, Claude 3 Haiku, Llama 3 70B, Gemma 2 27B, Qwen 2.5 72B) and an **oddball wing** (a diffusion language model, a community 405B finetune, a released-then-pulled MoE, a 1-billion-parameter miniature, and friends) — all accessed through OpenRouter with IDs verified against the live catalog and live-pinged on collection day: [`data/roster.json`](data/roster.json), `ROSTER-NOTES.md`. Knowledge cutoffs differ and several predate final World Cup qualification (the legacy wing predates parts of qualifying entirely); the prompt supplies the fixture list, the rest is what the model knows — that asymmetry is part of what's being measured.

## Caveats, honestly stated

- One run at temperature 0 samples one trajectory, not a model's full predictive distribution.
- **Family correlation:** models from the same vendor lineage can converge hard (the two Gemini entries agreed on 62 of 72 group scorelines). 33 entries ≠ 33 independent opinions.
- Simulated third-place ranking uses points → goal difference → goals scored, then alphabetical; FIFA's later criteria (conduct score, world ranking) aren't computable from predicted scores. Deep ties are rare and the rule is identical for every model.
- Knockout scorelines are scored on the 90-minute result (standard prediction-game convention); penalties/extra time are captured by the "advances" answer.
- Football is high-variance and bracket scoring is top-heavy by design — a lucky champion call moves the table. That's the game.

## Results entry

Real results are recorded after each match (90-minute score; advancing team for knockouts), committed publicly with full history; real knockout fixtures are added as reality produces them, which is when bracket components start paying out. Corrections happen by commit and are listed in the changelog.
