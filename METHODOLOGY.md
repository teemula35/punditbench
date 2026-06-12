# PunditBench Methodology — 2026 World Cup edition

PunditBench measures how well large language models predict real football. For the 2026 FIFA World Cup, every participating model predicts **its own complete tournament** — all 72 group matches and then, derived from its own predictions, its own knockout bracket through to its own champion — entirely **before the opening kickoff**. Reality then scores every claim. (PunditBench is an independent project, not affiliated with FIFA; tournament and team names are used editorially. All predictions shown are AI-generated content.)

> The initial methodology (2026-06-10) collected group-stage predictions and planned to reveal real knockout pairings round by round. It was upgraded to the self-consistent bracket-simulation design described below on 2026-06-11, **before the opening match**; the group-stage collection is identical under both and was not re-run. Full history in CHANGELOG.md.

## How predictions are collected

1. **Group stage.** Every model receives one identical prompt with all 72 group fixtures (official match numbers, teams, dates, venues) and returns a strict-JSON score for each. No tools, no web access, training knowledge only; `temperature: 0` where the model accepts it (recorded per call).
2. **Self-consistent knockout simulation.** From the model's own 72 scores we compute its group tables (FIFA tiebreakers: points, goal difference, goals scored, head-to-head) and its qualified third-placed teams, slot the thirds using **FIFA's official Annexe C lookup table** (all 495 combinations, parsed from the official regulations — see ALLOCATION-NOTES.md), and obtain the model's own Round of 32. The model is then prompted with *its own* bracket — explicitly framed as "the knockout bracket that follows from YOUR OWN predictions" — and predicts those 16 matches, naming the team that advances where it predicts a 90-minute draw. Its answers build its Round of 16, and so on through the quarter-finals, semi-finals, third-place match and final. Six prompts per model; every model ends with a full simulated tournament and a champion.
3. **Everything is locked pre-kickoff.** No prediction anywhere in the system depends on a single real result. The complete set (group + all simulated rounds, raw API traffic included) is hashed and pre-registered before the opening match.

## The exact prompt

Prompt template `v1` lives in [`lib/prompt.ts`](https://github.com/teemula35/punditbench/blob/main/lib/prompt.ts). The group-stage prompt below is **byte-identical for every model** and reproduced here verbatim, generated from that template — it matches the `prompt` field of every group-stage record in the published raw logs:

```text
PunditBench — a public benchmark in which language models predict football match results for the 2026 FIFA World Cup (48 teams, USA/Canada/Mexico).

Your task: predict the result of every group stage match listed at the end of this prompt.

Output rules (strict):
- Respond with ONLY one JSON object. No markdown fences, no explanations, no other text.
- Format: {"predictions":[{"match":1,"home_goals":2,"away_goals":0},...]}
- home_goals/away_goals: integers 0-15, the final score after 90 minutes plus stoppage time (draws are possible in the group stage).
- Exactly one entry per listed match number — all of them.

Scoring (identical for all participants): exact score = 3 points; correct goal difference = 2; correct outcome (win/draw/loss) = 1.

Matches to predict (match number | group | home vs away | date | city):
1 | A | Mexico vs South Africa | 2026-06-11 | Mexico City
2 | A | South Korea vs Czech Republic | 2026-06-12 | Zapopan
3 | B | Canada vs Bosnia and Herzegovina | 2026-06-12 | Toronto
4 | D | United States vs Paraguay | 2026-06-13 | Inglewood
5 | C | Haiti vs Scotland | 2026-06-14 | Foxborough
6 | D | Australia vs Turkey | 2026-06-14 | Vancouver
7 | C | Brazil vs Morocco | 2026-06-13 | East Rutherford
8 | B | Qatar vs Switzerland | 2026-06-13 | Santa Clara
9 | E | Ivory Coast vs Ecuador | 2026-06-14 | Philadelphia
10 | E | Germany vs Curaçao | 2026-06-14 | Houston
11 | F | Netherlands vs Japan | 2026-06-14 | Arlington
12 | F | Sweden vs Tunisia | 2026-06-15 | Guadalupe
13 | H | Saudi Arabia vs Uruguay | 2026-06-15 | Miami Gardens
14 | H | Spain vs Cape Verde | 2026-06-15 | Atlanta
15 | G | Iran vs New Zealand | 2026-06-16 | Inglewood
16 | G | Belgium vs Egypt | 2026-06-15 | Seattle
17 | I | France vs Senegal | 2026-06-16 | East Rutherford
18 | I | Iraq vs Norway | 2026-06-16 | Foxborough
19 | J | Argentina vs Algeria | 2026-06-17 | Kansas City
20 | J | Austria vs Jordan | 2026-06-17 | Santa Clara
21 | L | Ghana vs Panama | 2026-06-17 | Toronto
22 | L | England vs Croatia | 2026-06-17 | Arlington
23 | K | Portugal vs DR Congo | 2026-06-17 | Houston
24 | K | Uzbekistan vs Colombia | 2026-06-18 | Mexico City
25 | A | Czech Republic vs South Africa | 2026-06-18 | Atlanta
26 | B | Switzerland vs Bosnia and Herzegovina | 2026-06-18 | Inglewood
27 | B | Canada vs Qatar | 2026-06-18 | Vancouver
28 | A | Mexico vs South Korea | 2026-06-19 | Zapopan
29 | C | Brazil vs Haiti | 2026-06-20 | Philadelphia
30 | C | Scotland vs Morocco | 2026-06-19 | Foxborough
31 | D | Turkey vs Paraguay | 2026-06-20 | Santa Clara
32 | D | United States vs Australia | 2026-06-19 | Seattle
33 | E | Germany vs Ivory Coast | 2026-06-20 | Toronto
34 | E | Ecuador vs Curaçao | 2026-06-21 | Kansas City
35 | F | Netherlands vs Sweden | 2026-06-20 | Houston
36 | F | Tunisia vs Japan | 2026-06-21 | Guadalupe
37 | H | Uruguay vs Cape Verde | 2026-06-21 | Miami Gardens
38 | H | Spain vs Saudi Arabia | 2026-06-21 | Atlanta
39 | G | Belgium vs Iran | 2026-06-21 | Inglewood
40 | G | New Zealand vs Egypt | 2026-06-22 | Vancouver
41 | I | Norway vs Senegal | 2026-06-23 | East Rutherford
42 | I | France vs Iraq | 2026-06-22 | Philadelphia
43 | J | Argentina vs Austria | 2026-06-22 | Arlington
44 | J | Jordan vs Algeria | 2026-06-23 | Santa Clara
45 | L | England vs Ghana | 2026-06-23 | Foxborough
46 | L | Panama vs Croatia | 2026-06-23 | Toronto
47 | K | Portugal vs Uzbekistan | 2026-06-23 | Houston
48 | K | Colombia vs DR Congo | 2026-06-24 | Zapopan
49 | C | Scotland vs Brazil | 2026-06-24 | Miami Gardens
50 | C | Morocco vs Haiti | 2026-06-24 | Atlanta
51 | B | Switzerland vs Canada | 2026-06-24 | Vancouver
52 | B | Bosnia and Herzegovina vs Qatar | 2026-06-24 | Seattle
53 | A | Czech Republic vs Mexico | 2026-06-25 | Mexico City
54 | A | South Africa vs South Korea | 2026-06-25 | Guadalupe
55 | E | Curaçao vs Ivory Coast | 2026-06-25 | Philadelphia
56 | E | Ecuador vs Germany | 2026-06-25 | East Rutherford
57 | F | Japan vs Sweden | 2026-06-25 | Arlington
58 | F | Tunisia vs Netherlands | 2026-06-25 | Kansas City
59 | D | Turkey vs United States | 2026-06-26 | Inglewood
60 | D | Paraguay vs Australia | 2026-06-26 | Santa Clara
61 | I | Norway vs France | 2026-06-26 | Foxborough
62 | I | Senegal vs Iraq | 2026-06-26 | Toronto
63 | G | Egypt vs Iran | 2026-06-27 | Seattle
64 | G | New Zealand vs Belgium | 2026-06-27 | Vancouver
65 | H | Cape Verde vs Saudi Arabia | 2026-06-27 | Houston
66 | H | Uruguay vs Spain | 2026-06-27 | Zapopan
67 | L | Panama vs England | 2026-06-27 | East Rutherford
68 | L | Croatia vs Ghana | 2026-06-27 | Philadelphia
69 | J | Algeria vs Austria | 2026-06-28 | Kansas City
70 | J | Jordan vs Argentina | 2026-06-28 | Arlington
71 | K | Colombia vs Portugal | 2026-06-27 | Miami Gardens
72 | K | DR Congo vs Uzbekistan | 2026-06-27 | Atlanta
```

Knockout prompts reuse the same template with three differences, quoted verbatim from the template:

1. The format rule becomes `{"predictions":[{"match":74,"home_goals":2,"away_goals":1,"advances":"<team name exactly as listed>"},...]}` — `"advances"` is required for every match: "the team that progresses to the next round (after extra time/penalties if your predicted 90-minute score is a draw)".
2. The scoring line gains "correctly naming the advancing team = +1".
3. A context block precedes the fixtures, framing the bracket as the model's own: "You previously predicted every group-stage match of this tournament. The fixtures below are the knockout bracket that follows from YOUR OWN predictions. Your predicted tournament so far:" — followed by that model's final group tables (points, goal difference, goals for) and its prior simulated knockout results, then the fixture rows as `match number | home vs away | date | city`.

Because the tables and prior results are the model's own, every knockout prompt differs per model. Each one is preserved verbatim — alongside the raw response, parameters, token usage and HTTP status of every attempt — in [`data/raw/`](https://github.com/teemula35/punditbench/tree/main/data/raw) (`<stage>/<model>.jsonl`, `prompt` field).

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

A team "reaches" a stage by appearing in it; reach derives from the model's simulated pairings and its `advances` answers (Round-of-32 reach is determined entirely by the group predictions — computing the bracket needs no model input). Theoretical maximum: 216 (group) + 137 (advancement) + 32 (matchups) + 128 (matched scorelines) = **513**.

Leaderboard tiebreakers, in order: total points → most exact scores → correct champion → most correct Round-of-32 qualifiers → shared rank.

Voided/abandoned real matches score 0 for everyone and are excluded; documented in the changelog.

## Integrity rules

- **Kickoff cutoff (golden rule).** A prediction counts only if generated before the relevant information existed in reality — here, everything predates the opening kickoff (2026-06-11 19:00 UTC). Per-call timestamps are in the raw logs.
- **Pre-registration.** Canonical SHA-256 hashes of each locked prediction set are committed and tagged in the public repository before kickoff (`data/hashes/`, git tags). Anyone can recompute them from the published data.
- **Raw audit trail.** Every API request and response — including failed attempts and validator feedback — is published verbatim in `data/raw/`.
- **Frozen roster.** Fixed before the opening kickoff at 40 models (pre-kickoff expansions 18 → 33 → 44, every addition predicting under identical conditions before any match; then four models removed pre-kickoff because they could not produce fully valid prediction sets across four retry cycles, and two labs dropped because their catalog-listed endpoints served nothing — all raw attempts preserved in the published audit logs and documented in ROSTER-NOTES.md). Every ranked model therefore carries a complete tournament: 72 group scorelines and a full simulated bracket. Later additions, if ever, would be unranked exhibition entries.
- **Identical treatment.** Same prompt templates, same parameters policy, same validator for every model. Knockout prompts are personalized **only** by the model's own previous answers — which is the design, not an asymmetry.
- **Derived scoring.** Points are recomputed from raw predictions + results on every site build and re-derivable from raw logs via `npm run audit`.

## Validation & failure policy

Responses must cover every listed fixture exactly once with integer goals 0–15; knockout predictions must name a consistent advancing team. Invalid responses get up to 2 corrective retries with the validator's errors appended. Entries for *unlisted* match numbers are dropped with a logged warning rather than failing the response (rule relaxed pre-kickoff on 2026-06-11 after two small models enthusiastically predicted matches beyond the fixture list; all earlier-passing models unaffected — see CHANGELOG.md). Four models that still could not produce fully valid sets after four retry cycles (Granite 4.1 8B, LFM-2 24B, Phi-4 Mini, Llama 3.2 1B — all small models; the capability floor for this task format is real) were removed from the ranked roster before kickoff rather than carried as zero or partial entries; their raw attempts remain published in `data/raw/`.

## The roster

40 models across 19 vendors — current flagships, mid-tiers and small models, plus a **legacy wing** (2023–24 era: GPT-3.5 Turbo, GPT-4, GPT-4o, Claude 3 Haiku, Llama 3 70B, Gemma 2 27B, Qwen 2.5 72B) and an **oddball wing** (a diffusion language model, a community 405B finetune, a released-then-pulled MoE, and friends) — all accessed through OpenRouter with IDs verified against the live catalog and live-pinged on collection day: [`data/roster.json`](data/roster.json), `ROSTER-NOTES.md`. Knowledge cutoffs differ and several predate final World Cup qualification (the legacy wing predates parts of qualifying entirely); the prompt supplies the fixture list, the rest is what the model knows — that asymmetry is part of what's being measured.

## Caveats, honestly stated

- One run at temperature 0 samples one trajectory, not a model's full predictive distribution.
- **Family correlation:** models from the same vendor lineage can converge hard (the two Gemini entries agreed on 62 of 72 group scorelines). 33 entries ≠ 33 independent opinions.
- Simulated third-place ranking uses points → goal difference → goals scored, then alphabetical; FIFA's later criteria (conduct score, world ranking) aren't computable from predicted scores. Deep ties are rare and the rule is identical for every model.
- Knockout scorelines are scored on the 90-minute result (standard prediction-game convention); penalties/extra time are captured by the "advances" answer.
- Football is high-variance and bracket scoring is top-heavy by design — a lucky champion call moves the table. That's the game.

## Results entry

Real results are recorded after each match (90-minute score; advancing team for knockouts), committed publicly with full history; real knockout fixtures are added as reality produces them, which is when bracket components start paying out. Corrections happen by commit and are listed in the changelog.
