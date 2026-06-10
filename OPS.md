# PunditBench — Tournament operations runbook (v2)

Since the self-consistent simulation redesign (D9, 2026-06-11) **every prediction is already collected and locked** — there are no mid-tournament prediction runs. Remaining operations: enter real results, materialize real knockout fixtures as reality produces them, deploy. All times Helsinki (EEST, UTC+3).

## Daily routine during the tournament (~10 min, after the day's matches)

```powershell
npm run result -- <match> <home>-<away>          # repeat per finished match
# knockout days: npm run result -- 77 1-1 --advances "Spain" --note "pens 4-2"
npm test                                          # invariants still green
git add data/results.json; git commit -m "Results <date>"; git push
npm run build; firebase deploy --only hosting    # publish updated site
```

`record-result` prints every model's points for the match — eyeball against the site after deploy. Get the 90-minute score from two sources (FIFA + ESPN) before entering; knockouts: the recorded score is the 90' score, the `--advances` flag carries who went through.

## Real knockout fixtures (for bracket scoring), once per round

When a real round's pairings are final (last prerequisite match played):

1. `npm run knockout-fixtures -- --stage r32` — resolves group winners/runners-up and winner slots from real results. Third-place slots (R32 only): the script asks for `--set`; copy from the official bracket, **or** cross-check what `data/third-allocation.json` (FIFA Annexe C) dictates for the real qualified-groups combination — they must agree.
2. **Verify every pairing against the official bracket**, then commit. Bracket advancement/matchup points start flowing automatically — no prediction runs, no deadline pressure. Round timing: R32 pairings final June 27 night, R16 ~July 3, QF ~July 7, SF ~July 11, final pair ~July 15.

## Audits

`npm run audit` re-derives all predictions from raw logs and recomputes the leaderboard. Run before the knockouts (June 27) and before the final (July 18). Must print `AUDIT OK`.

## Incident runbook

- **Wrong result entered:** rerun `npm run result` with the correct score, commit — scoring is derived, everything self-corrects. CHANGELOG.md entry.
- **Wrong real fixture:** fix the stage file, commit, CHANGELOG.md entry. (Predictions are untouched by definition — they predate everything.)
- **Site down / bad deploy:** static export — `git revert` + push + redeploy. No server state exists.
- **Match abandoned/replayed:** `npm run result -- <match> --voided` (excluded for everyone), CHANGELOG.md; record the replay on the same match number with a note.
- **Group tie the standings code can't break** (needs conduct/world-ranking data): put the official order in `data/overrides/group-order.json` (or `third-order.json`), commit. Applies to REAL standings only — simulated brackets are already locked.

## Status (2026-06-11, pre-kickoff)

- [x] Group predictions: 33/33 models, hashed, tagged (`predictions-group`, `predictions-group-v2`)
- [ ] Knockout simulations: running — then hash + tag `predictions-full-tournament`, push, deploy
- [ ] First results entry: opener ends ~June 11 23:50 Helsinki
