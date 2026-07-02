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

## League operations (2026-27 season — near-zero-touch)

From August 2026 PunditBench covers the big European leagues (`data/competitions.json`;
only entries with `active: true` are processed). Everything below data-entry level is
automated; the human surface is red-run emails.

**What runs itself:**

- **Picks** — `.github/workflows/predict-scheduler.yml` (05:41 + 17:41 UTC daily):
  refreshes fixtures from ESPN (kickoff/TV reshuffles), then for every active
  competition whose next unlocked matchday kicks off within 36 h collects all models'
  form-aware picks (current table + last-5 form from our own results in the prompt),
  writes `data/competitions/<id>/predictions-live/<round>/`, manifest, round hash —
  then tests → commit → annotated tag `predictions-<id>-<round>-live` → deploy.
  Locked rounds are skipped, so reruns are safe. Matches that already kicked off are
  auto-excluded with a reason (shown as "not pre-registered").
- **Results** — the existing hourly `results-sync.yml` loops active competitions after
  the WC block. League results match fixtures by **ESPN event id** and ALL auto-enter
  (leagues have no knockout-pending). Recorded scores are re-audited hourly, same as WC.
- **Postponements** — resolve themselves: the match goes `OVERDUE`, the next scheduler
  run refreshes its kickoff into the future, the alert clears. Locked picks stand and
  score whenever the match is eventually played.

**Red run means one of:** `MODEL FAILED` (rerun `npm run league-predict -- --comp <id>
--round <mdNN> --only-missing` before kickoff, else that model shows "no pick");
fixture-refresh conflicts (team drift / event vanished / unknown new event — inspect the
Refresh step log; NEVER auto-resolved); a round locked with ZERO picks (scheduler was
down for a whole round — post-mortem); plus the WC-era `CONFLICT`/`OVERDUE` meanings.

**Onboarding a league** (per the rollout ladder): 1) if new, `npm run league-fixtures --
--comp <id>` (ingest validates round structure and refuses on problems); 2) BEFORE the
opener run the pre-season locked track: `npm run season-predict -- --comp <id>` → commit
+ tag `predictions-<id>-season`; 3) flip `active: true` in `data/competitions.json`,
commit — the schedulers take over.

**Manual cheat sheet:**

```powershell
npm run league-fixtures -- --all --dry            # plan fixture refresh, write nothing
npm run league-predict -- --comp epl-2026-27 --round md05 --dry-run   # print the exact prompt
npm run league-predict -- --due --mock            # rehearse the scheduler path
npm run hash -- --comp epl-2026-27 --round md05   # recompute a round's hash
npm run season-predict -- --comp epl-2026-27 --hash-only   # recompute season-table hash
```

**Secrets:** `OPENROUTER_API_KEY` (spend-capped key, Actions secret — NOT the local .env
key) + the existing `FIREBASE_SERVICE_ACCOUNT_PUNDITBENCH`. Epic H update: the
results-sync workflow and its service account now STAY post-tournament (they serve the
leagues); only WC-specific cleanup remains.

## Status (2026-06-12)

- [x] Group predictions: hashed + tagged; knockout simulations: hashed + tagged (`predictions-full-tournament-v4`, 40/40)
- [x] First results entry: match 1 Mexico 2–0 South Africa (manual, 2026-06-12 00:30 Helsinki)
- [x] Hourly auto-sync live (`results-sync.yml`); group results enter themselves, knockouts alert for manual entry
