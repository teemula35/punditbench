# PunditBench ⚽🤖

**Can LLMs forecast football when every pick is locked before kickoff?**

PunditBench is a public, continuously scored benchmark for football forecasts. The current weekly roster has **43 models** predicting matches across the Premier League, La Liga, Serie A, Bundesliga and Ligue 1. Each matchday is pre-registered before its first kickoff; results and scores then update automatically.

The completed **2026 World Cup benchmark remains available as a frozen 40-model archive**. League and World Cup scores are separate benchmarks and are not compared.

- 🌐 Live benchmark: **https://punditbench.com**
- 🏟️ Five league tracks: **https://punditbench.com/leagues/**
- 🔬 Methodology: [METHODOLOGY.md](METHODOLOGY.md) — prompts, scoring, eligibility and integrity rules
- 🔐 Pre-registration evidence: canonical SHA-256 records plus public commits and tags before kickoff
- 📜 Decisions and corrections: [DECISIONS.md](DECISIONS.md) · Operations: [OPS.md](OPS.md) · Changelog: [CHANGELOG.md](CHANGELOG.md)
- 📝 Opening-round brief: [complete free sample and optional €5 issue](https://punditbench.com/briefs/opening-round-2026/)

## How the league benchmark works

1. **Same reproducible context.** Every model eligible for a round receives the same fixtures and deterministic context. After the season starts this includes the current table, up to each team's five most recent final results, and rest days where a prior final exists; Matchday 1 uses the previous season's final table and promoted teams instead. Weekly prompts contain no odds, injuries, lineups or news.
2. **Lock before kickoff.** The scheduler normally collects a matchday about 36 hours before its first kickoff. Predictions are canonicalised, SHA-256 hashed, committed and tagged before play begins.
3. **Score against reality.** Exact score earns 3 points, correct goal difference 2 and correct outcome 1. Leaderboards rank by points per scored match, with the denominator shown.
4. **Keep failures visible.** A late match is labelled `not pre-registered`, never backfilled. A missing eligible prediction scores zero. New entrants begin only at their declared matchday and receive no retroactive picks.
5. **Publish the audit trail.** Fixtures, results, normalised predictions, raw provider responses, lock records and scoring code are public. Scores are derived again from primary data on each build.

Each league also has a separately locked pre-season final-table track, graded continuously against the current standings.

## Evidence layout

```text
data/competitions.json                  active league registry
data/roster-league.json                 current league roster and entry windows
data/competitions/<id>/fixtures.json    fixture schedule with source event ids
data/competitions/<id>/results.json     recorded final results
data/competitions/<id>/predictions-live/<round>/
data/competitions/<id>/raw-live/        provider request/response audit logs
data/competitions/<id>/hashes/          matchday and season lock records

data/roster.json                        frozen World Cup roster
data/predictions*/ and data/hashes/      frozen World Cup prediction records
```

The public Git tags use `predictions-<competition>-<round>-live` for league matchdays and `predictions-<competition>-season` for pre-season tables.

## Repository layout

```text
data/            fixtures, results, rosters, predictions, raw logs and lock records
lib/             scoring, standings, validation, prompts, canonicalisation and loaders
scripts/         collectors, fixture/result sync, audits and export preparation
app/             Next.js static site
tests/           scoring, integrity, runner, route and deployment regressions
```

## Local verification

```bash
npm ci
npm test
npx tsc --noEmit
npm run build:ci
```

`build:ci` is the CI-only, non-deploying export path; it does not require checkout configuration, and its output must not be deployed. `npm run build` fails closed unless `PB_BRIEF_CHECKOUT_URL` is a valid HTTPS `buy.stripe.com` link, then verifies that checkout in the exported page. Deploy workflows pass seller, support and policy values, but the build guard does not require or validate them.

Prediction and lock commands can write pre-registration artifacts. Follow [OPS.md](OPS.md) and inspect with `--dry-run`; **`--mock` is not a read-only rehearsal**.

## World Cup archive

The 2026 World Cup track is complete: 40 models predicted all 72 group matches and their own simulated knockout brackets before the opening kickoff. A separate round-by-round track covered the R32, R16, quarter-finals, semi-finals and final; R32 match 73 was transparently excluded because it had already kicked off, and no third-place live stage was collected. All 104 results are recorded and scored. The archive, raw logs, hashes and historical tags remain unchanged.

## Security

**"Isn't that a Google API key in `lib/site.ts`?"** Yes — and it is meant to be public. It is a Firebase browser identifier, [not a secret](https://firebase.google.com/docs/projects/api-keys). The key is restricted to Firestore, and [`firestore.rules`](firestore.rules) allow public reads plus creation at `1` or exact `+1` updates for an allowlisted set of counters; every other write is denied. The project has no billing attached.

No private keys, service-account credentials or model API keys live in this repository or its history. Runtime credentials are supplied through untracked local environment files or repository secrets.

*PunditBench is an independent project, not affiliated with FIFA, a league, federation or club. Competition and team names are used editorially. 18+ informational statistics only — not betting advice. All forecasts are AI-generated content.*
