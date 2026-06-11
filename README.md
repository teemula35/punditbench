# PunditBench ⚽🤖

**Can AI call the beautiful game?** 18 large language models predict every match of the 2026 World Cup — all 104 of them, stage by stage, locked in before kickoff and scored against reality.

- 🌐 Site: **https://punditbench.com** (punditbench.web.app works as an alias)
- 📊 Methodology: [METHODOLOGY.md](METHODOLOGY.md) — prompts, scoring, integrity rules
- 📜 Decisions & rationale: [DECISIONS.md](DECISIONS.md) · Backlog: [BACKLOG.md](BACKLOG.md) · Ops: [OPS.md](OPS.md)
- 🔐 Pre-registration: each stage's predictions are hashed (SHA-256) and the hash committed + tagged before kickoff (`data/hashes/`)

## How it works

1. **Before the tournament:** every model gets one identical prompt with all 72 group-stage fixtures → strict-JSON score predictions.
2. **After each round:** models get the real next-round pairings + actual results so far → predict the round. Repeat to the final.
3. **Scoring:** exact score 3 · correct goal difference 2 · correct outcome 1 · (+1 for the advancing team in knockouts). Scored on the 90-minute result.
4. Everything — raw API responses, predictions, results, scores — is in this repo and on the site. Scores are recomputed from primary data on every build.

## Repo layout

```
data/            fixtures, teams, roster, results, predictions, raw API logs, hashes
lib/             scoring engine, standings, validation, prompt builder, data loaders
scripts/         predict (runner), record-result, hash, audit, make-knockout-fixtures
app/             Next.js site (static export)
tests/           scoring/standings/validation/fixture-invariant tests
```

## Commands

```powershell
npm test                                   # the whole test suite (CI runs this too)
npm run predict -- --stage group           # run predictions (needs OPENROUTER_API_KEY in .env)
npm run predict -- --stage group --mock    # pipeline rehearsal without a key
npm run hash -- --stage group              # canonical SHA-256 for pre-registration
npm run result -- 1 2-1                    # record a result (+ prints points per model)
npm run knockout-fixtures -- --stage r32   # resolve next round fixtures from results
npm run audit                              # re-derive everything from raw logs, verify
npm run build                              # static site -> ./out
firebase deploy --only hosting             # publish ./out to punditbench.web.app
```

## Status

- [x] Methodology, scoring engine + tests, fixture data (two independent source sets, reconciled)
- [x] Runner + audit pipeline rehearsed end-to-end (mock)
- [ ] **Group-stage prediction run** — before kickoff Jun 11 19:00 UTC
- [ ] Hash tagged + pushed (pre-registration)
- [ ] Site deployed (Cloud Run; static export)

*PunditBench is an independent project, not affiliated with FIFA or any federation. Tournament and team names are used editorially. Statistics & entertainment only — not betting advice. All predictions are AI-generated content.*
