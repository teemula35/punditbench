This completed historical issue shows the full format planned for the five-league brief. It uses
the World Cup round-by-round track, not the league benchmark, so the two fields and their scores
should not be compared.

The scope is eight round-of-16 fixtures, matches 89–96. Picks were locked before the first kickoff.
The analysis below was recomputed read-only from the published normalized files, results and scoring
code on 14 August 2026. It did not rewrite a prediction, hash or tag.

## 1. Scorecard

| Metric | Result |
|---|---:|
| Ranked World Cup roster | 40 models |
| Valid round-of-16 model files | 38/40 |
| Valid model-match predictions | 304 (38 × 8) |
| Missing predictions against the full roster | 16 (2 × 8) |
| Exact score classifications | 1/304 |
| Correct goal-difference classifications | 81/304 |
| Correct-outcome-only classifications | 85/304 |
| No 90-minute score points | 137/304 |
| Correct advancers | 195/304 |
| Base score points | 250 |
| Advance-bonus points | 195 |
| Total points across the round | 445 |

The 90-minute score classes are mutually exclusive: exact score earns 3 points, correct goal
difference 2, correct outcome 1, otherwise 0. A correct knockout advancer adds 1.

Two roster models produced no valid round file:

- GPT-3.5 Turbo returned six HTTP-200 responses, but every response failed validation.
- Llama 3 70B returned six HTTP 404 responses saying no endpoint was available.

**Round winner:** [Mistral Medium 3.5](/models/mistralai-mistral-medium-3-5/) scored 17 points over
eight picks. Claude 3 Haiku also scored 17; Mistral won the tiebreak by scoring on seven matches
rather than six.

**Cumulative round-by-round leader after the round of 16:**
[GLM 4.7 Flash](/models/z-ai-glm-4-7-flash/) had 50 points. GPT-4o also had 50, but GLM led the
tiebreak with seven exact scores to GPT-4o's six.

The round's only exact score came from [GPT-5.5 Pro](/models/openai-gpt-5-5-pro/), which predicted
Portugal 0–1 Spain in [match 93](/matches/93/).

## 2. Largest leaderboard moves

### Selection rule

1. Snapshot A is the cumulative round-by-round table after round-of-32 matches 74–88. Match 73 is
   excluded because it had kicked off before that round was collected.
2. Snapshot B adds round-of-16 matches 89–96.
3. Both snapshots use the published live-track tiebreakers: points, exact scores, matches with
   points, correct advancers, then a shared rank.
4. Compare only models with valid files in both rounds, sort by rank change, and publish the top
   three rises and top three falls, including a tie at the cutoff.

The pre-round field had 38 models. The post-round table had 39 models with at least one live-round
file: 37 had both rounds and 23 stored picks, GPT-3.5 Turbo had only its 15 round-of-32 picks, and
Claude Fable 5 entered with eight round-of-16 picks. Every mover below had 23 stored picks.

### Largest rises

| Model | Before | After | R16 points | Move |
|---|---:|---:|---:|---:|
| [Claude 3 Haiku](/models/anthropic-claude-3-haiku/) | #32/38, 26 pts | #16/39, 43 pts | +17 | **+16** |
| [Mistral Medium 3.5](/models/mistralai-mistral-medium-3-5/) | #23/38, 29 pts | #8/39, 46 pts | +17 | **+15** |
| [Qwen 2.5 72B](/models/qwen-qwen-2-5-72b-instruct/) | #37/38, 24 pts | #26/39, 40 pts | +16 | **+11** |

### Largest falls

| Model | Before | After | R16 points | Move |
|---|---:|---:|---:|---:|
| [MiniMax M3](/models/minimax-minimax-m3/) | #12/38, 32 pts | #27/39, 39 pts | +7 | **−15** |
| [Qwen3.7 Max](/models/qwen-qwen3-7-max/) | #22/38, 29 pts | #35/39, 36 pts | +7 | **−13** |
| [Command A](/models/cohere-command-a/) | #13/38, 32 pts | #22/39, 41 pts | +9 | **−9** |
| [GPT-5.5](/models/openai-gpt-5-5/) | #8/38, 33 pts | #17/39, 42 pts | +9 | **−9** |

Claude Fable 5 was a new entrant, not a mover: it joined at #39/39 with 13 points from eight picks.
The repository did not store a historical leaderboard snapshot; these positions are read-only
derivations from the locked round files and recorded results.

## 3. Five highest-consensus calls

### Selection rule

For each fixture, count the modal 90-minute outcome (home win, draw or away win) over the 38 valid
files. Rank matches by support for that outcome, descending, break ties by match number, and take
exactly five. A call succeeds only when the modal outcome matches the recorded 90-minute outcome.
The modal scoreline is shown for context but does not decide the verdict.

| Match | Outcome split H/D/A | Modal score | Recorded result | Verdict |
|---|---:|---:|---:|---|
| [89: Paraguay–France](/matches/89/) | 0/0/**38 away** | 0–2 (20/38) | 0–1 | **Success** |
| [91: Brazil–Norway](/matches/91/) | **38 home**/0/0 | 2–1 (23/38) | 1–2 | **Failure** |
| [95: Argentina–Egypt](/matches/95/) | **38 home**/0/0 | 2–0 (25/38) | 3–2 | **Success** |
| [93: Portugal–Spain](/matches/93/) | 1/8/**29 away** | 1–2 (26/38) | 0–1 | **Success** |
| [94: United States–Belgium](/matches/94/) | **23 home**/6/9 | 2–1 (21/38) | 1–4 | **Failure** |

The fixed rule selected three successes and two failures. It includes the unanimous Brazil call,
which was wrong, rather than replacing it with a better-looking result after the fact.

## 4. Lock and hash audit

The live manifest at
[/data/predictions-live/manifest.json](/data/predictions-live/manifest.json) says:

- manifest lock: `2026-07-04T07:21:30.187Z`;

The stored integrity record at [/data/hashes/r16-live.txt](/data/hashes/r16-live.txt) says:

- track: `round-by-round (live, real fixtures)`;
- stage: `r16`;
- models: 38;
- digest generated: `2026-07-04T07:21:51.720Z`;
- SHA-256:
  `9383ed8eb9ac1e8e69b70cb7efb1d0f7e8aceb60f1e98de2a18fc918288e64a3`.

Git records the annotated tag
[`predictions-r16-live`](https://github.com/teemula35/punditbench/tree/predictions-r16-live), tag
object `11e14c44e8f6dec7568a4bebdfff4da47b7a1294`, pointing to commit
[`db29c10873bc409f629a6a84d07cef04fa5634dd`](https://github.com/teemula35/punditbench/commit/db29c10873bc409f629a6a84d07cef04fa5634dd).
The commit time was `2026-07-04T10:22:09+03:00` (`07:22:09Z`). The earliest round-of-16 kickoff,
Canada–Morocco, was `17:00Z` that day.

The digest covers canonicalized normalized records sorted by model and match. It does not claim to
cover raw logs, usage/cost metadata, fixtures or results. Results were committed later, after the
matches. Git history shows no later change to the locked R16 prediction directory or hash file.

## 5. Parser, provider and data issues

The public raw record contains 40 model files and 54 attempts: 38 successful records and 16 failed
records. Forty-seven attempts returned HTTP 200, six returned HTTP 404, and one transport/parser
record had no HTTP status. The 38 successful records produced 38 normalized files.

Material examples:

- Llama 3 70B made six attempts; every one returned HTTP 404 with "No endpoints found". It has no
  normalized round file.
- GPT-3.5 Turbo made six HTTP-200 attempts, but invalid team names and contradictions between the
  score and named advancer prevented every response from passing validation. It has no normalized
  round file.
- Gemma 2 27B first predicted Portugal 2–1 Spain while naming Spain as the advancer. Its second
  response corrected the contradiction and passed.
- Llama 4 Scout's first response began with a malformed JSON fragment and could not be parsed. Its
  second response passed.
- GPT-5.5 Pro returned empty content, then an incomplete JSON error, then passed on its third
  attempt. The successful call used 10,894 tokens, cost $1.32207 as recorded in the file, and later
  supplied the round's only exact score.

A coverage caveat matters for the cumulative table: a missing entire round file does not create
eight explicit zero-scored matches. A model with an earlier live file stays ranked on its earlier
points, while a new model can enter with a later round only. The movement table above limits its
listed models to those with valid files in both rounds, although their field ranks still come from
the mixed-coverage table.

## 6. Evidence and correction log

Primary evidence:

- [R16 fixtures](/data/fixtures/r16.json)
- [recorded results](/data/results.json)
- [live manifest](/data/predictions-live/manifest.json)
- [normalized R16 files](https://github.com/teemula35/punditbench/tree/db29c10873bc409f629a6a84d07cef04fa5634dd/data/predictions-live/r16)
- [raw R16 logs](https://github.com/teemula35/punditbench/tree/db29c10873bc409f629a6a84d07cef04fa5634dd/data/raw-live/r16)
- [stored hash at the lock commit](https://github.com/teemula35/punditbench/blob/db29c10873bc409f629a6a84d07cef04fa5634dd/data/hashes/r16-live.txt)
- [scoring method](/methodology/)
- [validator source](https://github.com/teemula35/punditbench/blob/main/lib/validate.ts)

Result and correction record:

- Matches 89–92 were recorded in
  [`9acdc71d`](https://github.com/teemula35/punditbench/commit/9acdc71d6c02bb928b8886c26f9be83373ad67b6).
- Matches 93–96 were recorded in
  [`9fdf9bd9`](https://github.com/teemula35/punditbench/commit/9fdf9bd9d4b2f38117d6e31f58726faadde39f8e).
- Commit [`62e88aee`](https://github.com/teemula35/punditbench/commit/62e88aeed6c428b349af5624bcfda13e3885eb5e)
  corrected match 92's weather-delayed kickoff from `00:00Z` to `01:00Z`. It changed fixture timing,
  not teams, predictions, scoring or the hash.
- No later edit to the locked R16 prediction/hash tree was found. The current changelog does not
  carry a dedicated entry for the match-92 timing correction even though the methodology says
  corrections are listed there. This is a transparency gap; the commit is linked directly here
  rather than calling the changelog complete.
