# PunditBench — Tournament operations runbook

All times below: Helsinki (EEST, UTC+3). Matches are in North American timezones, so "night of" a US matchday = early morning Helsinki.

## The five knockout prompt-run windows (G1) — calendar these

| # | When (Helsinki) | What | Commands |
|---|---|---|---|
| 1 | **Sun Jun 28, ~05:00–18:00** (after last group match ends Jun 27 night US time; R32 starts Jun 28) | Round of 32 | see "Window procedure" |
| 2 | **Sat Jul 4, ~05:00–18:00** (R32 ends Jul 3; R16 starts Jul 4) | Round of 16 | 〃 |
| 3 | **Wed Jul 8 – Thu Jul 9 morning** (R16 ends Jul 7; QF starts Jul 9) | Quarter-finals | 〃 |
| 4 | **Sun Jul 12 – Mon Jul 13** (QF ends Jul 11; SF starts Jul 14) | Semi-finals | 〃 |
| 5 | **Thu Jul 16 – Fri Jul 17** (SF ends Jul 15; bronze Jul 18, final Jul 19) | Bronze + Final (two stage runs: `third`, `final`) | 〃 |

Windows 1–2 are overnight-tight (~12–18 h). Run as early in the window as possible; **never write new code during a window** — everything is rehearsed beforehand (A7).

## Window procedure (rehearsed; ~20 min)

1. Make sure all of the previous round's results are recorded (`data/results.json` complete for that stage).
2. Resolve fixtures from the bracket: `npm run knockout-fixtures -- --stage r32`
   - Group-position slots (1A, 2B…) and winner slots (W74) resolve automatically from results.
   - Third-place slots (R32 only) need manual `--set "3C/D/F/G/H=France"` — copy from the official bracket once published. If the script reports a group-order tie it can't break, create `data/overrides/group-order.json` with the official order.
3. **Verify the printed fixtures against the official bracket. Every pairing.**
4. Run predictions: `npm run predict -- --stage r32`
   - Failures? `npm run predict -- --stage r32 --only-missing` retries just the failed models. Persistent provider outage → model scores 0 for the round (D5); document in CHANGELOG.md.
5. Lock + publish: `npm run hash -- --stage r32`, then commit + tag + push as the script prints.
6. Publish: `npm run build; firebase deploy --only hosting`. Spot-check one match page.

## Daily routine during the tournament (G2, ~10 min, after the day's matches)

```powershell
npm run result -- <match> <home>-<away>          # repeat per finished match
# knockout days: npm run result -- 77 1-1 --advances "Spain" --note "pens 4-2"
npm test                                          # invariants still green
git add data/results.json; git commit -m "Results <date>"; git push
npm run build; firebase deploy --only hosting    # publish updated site
```

`record-result` prints every model's points for the match — eyeball it against the site after CI deploys. Get the 90-minute score from two sources (e.g. FIFA + ESPN) before entering; knockout matches: the recorded score is the 90' score, NOT after extra time.

## Audit before the knockouts (G4) — Jun 27

`npm run audit` re-derives all predictions from the raw JSONL logs and recomputes the leaderboard from primary data. Must print `AUDIT OK` and match the live site. Run it again before the final.

## Incident runbook (G3)

- **Provider/model down during a window:** OpenRouter reroutes between hosts automatically; if a model still fails after `--only-missing` retries across the window, it takes 0 for the round per D5. Disclose in CHANGELOG.md. Never extend past kickoff (golden rule).
- **Wrong result entered:** rerun `npm run result -- <match> <correct>`, commit; scoring is derived so everything self-corrects. Add a CHANGELOG.md line.
- **Wrong fixture discovered pre-kickoff:** fix `data/fixtures/*.json`, rerun the affected stage for ALL models (identical information requirement), re-hash, document.
- **Site down / bad deploy:** static export — redeploy previous commit (`git revert` + push, CI redeploys). Nothing else can break: there is no server state.
- **Match abandoned/replayed:** `npm run result -- <match> --voided` (0 pts for all, excluded from counts), CHANGELOG.md entry; if replayed, record the replay result on the same match number and note it.

## Pre-kickoff checklist (today, Jun 10)

- [ ] `.env` has `OPENROUTER_API_KEY` + credits loaded
- [ ] `npm test` green; `npm run predict -- --stage group --mock` then `npm run audit` OK (pipeline rehearsal); delete mock artifacts (`data/predictions/`, `data/raw/`) before the real run
- [ ] Smoke: `npm run predict -- --stage group --models <two cheap ids>` → eyeball both prediction files
- [ ] Full run: `npm run predict -- --stage group` (~5–15 min)
- [ ] `npm run hash -- --stage group` → commit, tag `predictions-group`, push (public repo = pre-registration)
- [ ] All before the opening kickoff: **Jun 11 13:00 Mexico City = Jun 11 22:00 Helsinki** — treat **Jun 11 12:00 Helsinki** as the internal deadline; don't play it close.
