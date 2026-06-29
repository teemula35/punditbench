# PunditBench — Tournament operations runbook (v2)

Since the self-consistent simulation redesign (D9, 2026-06-11) the locked-bracket benchmark is **already collected and locked** — no mid-tournament runs for it. Remaining operations: enter real results, materialize real knockout fixtures as reality produces them, deploy. The optional **round-by-round track** (see below) adds one short, time-boxed prediction run per knockout round. All times Helsinki (EEST, UTC+3).

## Results entry is automated (group stage)

An hourly GitHub Action (`.github/workflows/results-sync.yml`, minute :07) polls ESPN's
public scoreboard JSON for every date that still has a pending past-kickoff fixture.
New finished **group** matches are entered with the same canonical write as
`npm run result`, then: `npm test` → commit to main → rebuild → deploy hosting.
The run **fails after committing/deploying** whenever something needs a human, so a
red run + GitHub email means act on one of:

- `KNOCKOUT PENDING` — a knockout match finished; enter it manually (needs `--advances`/`--note` judgment)
- `CONFLICT` — a recorded result disagrees with ESPN; investigate, the sync never overwrites
- `UNMAPPED` — strict mapping refused an event (team name / kickoff mismatch); fix `lib/sync.ts` aliases or the fixture
- `OVERDUE` — a fixture is 12 h past kickoff with no final result on ESPN (abandoned? voided? check, see incidents)

Every sync run also re-checks already-recorded scores against ESPN (continuous audit).
Run on demand: GitHub → Actions → results-sync → Run workflow (`force_deploy` rebuilds
without new results). Local: `npm run sync-results` (add `--dry` to plan without writing).
CI deploy auth: repo secret `FIREBASE_SERVICE_ACCOUNT_PUNDITBENCH`
(service account `github-results-sync@punditbench.iam.gserviceaccount.com`, role Firebase
Hosting Admin). Post-tournament (Epic H): delete the workflow file and the service account.

## Manual entry — knockout matches, corrections, fallback (~10 min)

```powershell
npm run result -- <match> <home>-<away>          # repeat per finished match
# knockout days: npm run result -- 77 1-1 --advances "Spain" --note "pens 4-2"
npm test                                          # invariants still green
git add data/results.json; git commit -m "Results <date>"; git push
npm run build; firebase deploy --only hosting    # publish updated site
```

`record-result` prints every model's points for the match — eyeball against the site after deploy. Get the 90-minute score from two sources (FIFA + ESPN) before entering; knockouts: the recorded score is the 90' score, the `--advances` flag carries who went through. (A push without deploy is also fine — the next hourly sync that finds results deploys, or trigger the workflow with `force_deploy`.)

## Real knockout fixtures (for bracket scoring), once per round

When a real round's pairings are final (last prerequisite match played):

1. `npm run knockout-fixtures -- --stage r32` — resolves group winners/runners-up and winner slots from real results. Third-place slots (R32 only): the script asks for `--set`; copy from the official bracket, **or** cross-check what `data/third-allocation.json` (FIFA Annexe C) dictates for the real qualified-groups combination — they must agree.
2. **Verify every pairing against the official bracket**, then commit. Bracket advancement/matchup points start flowing automatically — no prediction runs, no deadline pressure. Round timing: R32 pairings final June 27 night, R16 ~July 3, QF ~July 7, SF ~July 11, final pair ~July 15.

## Round-by-round live picks (second track), per round, BEFORE kickoff

A separate benchmark in which every model predicts the **real** knockout pairings of one round directly (scored like group matches), as opposed to the locked self-consistent bracket. Stored under `data/predictions-live/` + `data/raw-live/` — the locked tree is never touched. Surfaces as the "Round-by-round picks" section on each knockout match page. **Time-boxed:** picks only count if locked before the round's first kickoff, so run this in the window between the bracket being set and kickoff.

```powershell
# 1. Real fixtures for the round (see section above; R32 needs --set for thirds).
npm run knockout-fixtures -- --stage r32
# 2. Enter results for matches in this round that have ALREADY kicked off, so models
#    get accurate context and we can honestly exclude them from pre-registration.
npm run result -- 73 2-1 --advances "<team>"
# 3. Collect live picks, excluding already-kicked-off matches (rehearse with --mock).
npm run predict -- --stage r32 --live --exclude 73,74
#    omit --exclude when the whole round is still upcoming (R16 onward);
#    --only-missing retries just the models that failed; --dry-run prints the prompt.
# 4. Pre-register BEFORE the next kickoff.
npm run hash -- --stage r32 --live
git add -A; git commit -m "Round-by-round r32 live picks (sha256=...)"
git tag predictions-r32-live; git push --follow-tags
# 5. Publish (or let the next hourly sync deploy).
npm run build; firebase deploy --only hosting
```

Audit this track with `npm run audit -- --live` (revalidates live files against `data/raw-live/` logs; excluded matches are skipped). Cost is small — ~40 models × one short prompt per round. Repeat for r16, qf, sf, third/final. Miss the window and that round simply has no live picks (the page shows "pending" / "not pre-registered") — the locked bracket is unaffected. `--exclude` matches are recorded with a reason in `data/predictions-live/manifest.json`.

## Audits

`npm run audit` re-derives all predictions from raw logs and recomputes the leaderboard. Run before the knockouts (June 27) and before the final (July 18). Must print `AUDIT OK`.

## Incident runbook

- **Wrong result entered:** rerun `npm run result` with the correct score, commit — scoring is derived, everything self-corrects. CHANGELOG.md entry.
- **Wrong real fixture:** fix the stage file, commit, CHANGELOG.md entry. (Predictions are untouched by definition — they predate everything.)
- **Site down / bad deploy:** static export — `git revert` + push + redeploy. No server state exists.
- **Match abandoned/replayed:** `npm run result -- <match> --voided` (excluded for everyone), CHANGELOG.md; record the replay on the same match number with a note.
- **Group tie the standings code can't break** (needs conduct/world-ranking data): put the official order in `data/overrides/group-order.json` (or `third-order.json`), commit. Applies to REAL standings only — simulated brackets are already locked.

## Status (2026-06-12)

- [x] Group predictions: hashed + tagged; knockout simulations: hashed + tagged (`predictions-full-tournament-v4`, 40/40)
- [x] First results entry: match 1 Mexico 2–0 South Africa (manual, 2026-06-12 00:30 Helsinki)
- [x] Hourly auto-sync live (`results-sync.yml`); group results enter themselves, knockouts alert for manual entry
