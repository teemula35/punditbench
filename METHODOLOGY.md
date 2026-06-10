# PunditBench Methodology — 2026 World Cup edition

PunditBench measures how well large language models predict real football results. For the 2026 FIFA World Cup, every participating model predicts all 104 matches, stage by stage, under identical conditions. This page is the complete, reproducible methodology. (PunditBench is an independent project, not affiliated with FIFA; tournament and team names are used editorially only.)

## How predictions are collected

- **Stage-by-stage prompting.** Before the tournament, every model receives one prompt containing all 72 group-stage fixtures and returns a predicted score for each. After the group stage, when the real Round-of-32 bracket is known, every model receives the real pairings — plus a summary of actual results so far — and predicts that round. The same repeats for each subsequent round (R16, QF, SF, then bronze + final together). Models therefore react to the real tournament as it unfolds, like any pundit.
- **Identical prompts.** Every model gets the byte-identical prompt for a given stage (template version `v1`, source: `lib/prompt.ts`, reproduced in the repository). No model names, no special instructions per model.
- **Training knowledge only.** Models are called through the OpenRouter chat-completions API with no tools, no web search, and no retrieval. Prompts contain no squad lists, injury news, or betting odds.
- **Parameters.** `temperature: 0` where the model accepts it (some reasoning models do not accept sampling parameters; those run at provider defaults — recorded per call). Single attempt per model (no best-of-N). Exact request parameters for every call are in the raw audit logs (`data/raw/`).
- **Validation and retries.** Responses must be strict JSON covering every fixture exactly once with integer goals (0–15); knockout predictions must name the advancing team consistently. Invalid responses get up to 2 corrective retries with the validator's errors appended. A model that still fails scores 0 for the affected matches, and the failure is disclosed on its model page.

## Integrity rules

- **Kickoff cutoff (golden rule).** A prediction counts for a match only if it was generated before that match's kickoff. Timestamps are recorded per API call and preserved in the audit logs.
- **Pre-registration.** After each stage's collection run, a canonical SHA-256 hash of all predictions is computed (`scripts/hash.ts`), committed, and pushed to the public repository before kickoff. Anyone can recompute the hash from the published data.
- **Raw audit trail.** Every API request and response — including failed attempts — is stored verbatim in `data/raw/<stage>/<model>.jsonl` and published.
- **Frozen roster.** The roster was fixed at the group-stage run. Models added later (if any) would be shown as unranked exhibition entries.
- **Derived scoring.** Points are never stored or hand-edited; they are recomputed from raw predictions + results on every site build, and `npm run audit` re-derives everything from the raw logs to detect drift.

## Scoring

Scored against the result after 90 minutes plus stoppage time:

| Outcome | Points |
|---|---|
| Exact score | 3 |
| Correct goal difference (includes any correct draw) | 2 |
| Correct outcome (win/draw/loss) | 1 |
| Otherwise, or no valid prediction | 0 |

Knockout matches add **+1** for correctly naming the team that advances (covering extra time and penalties). Knockout scorelines are scored against the 90-minute result, the standard convention in football prediction games. Maximum: 3 per group match, 4 per knockout match, 344 in total.

Leaderboard tiebreakers, in order: total points → most exact scores → most matches with at least 1 point → most correct advancing teams → shared rank.

Voided or abandoned matches score 0 for everyone and are excluded from all counts; any such event is documented in the changelog.

## The roster

The exact model list with snapshot IDs, parameters, pricing, and known knowledge cutoffs is in [`data/roster.json`](data/roster.json) and `ROSTER-NOTES.md`: the current flagship plus (where available) one small model from each major vendor, accessed through OpenRouter, IDs verified against the live catalog on collection day. Knowledge cutoffs differ between models — that asymmetry is part of what the benchmark measures and is displayed per model rather than corrected for.

## Caveats, honestly stated

- A single run at temperature 0 measures one deterministic-ish sample, not the model's full predictive distribution.
- Football is high-variance; 104 matches is a meaningful but not enormous sample. Treat small leaderboard gaps accordingly.
- Models cannot know post-cutoff information (final squads, injuries, form). That is by design: the benchmark asks what a model can do with what it learned.
- All outputs shown on this site are AI-generated content.

## Results entry

Real results are entered after each match (90-minute score; advancing team for knockouts), committed to the public repository with full history. Corrections, if ever needed, are made by commit and listed in the changelog.
