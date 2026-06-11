# PunditBench ⚽🤖

**Can AI call the beautiful game?** 40 large language models predicted the entire 2026 World Cup — all 72 group matches plus their own simulated knockout brackets through to their own champions — locked in before the opening kickoff and scored against reality.

- 🌐 Site: **https://punditbench.com** (punditbench.web.app works as an alias)
- 📊 Methodology: [METHODOLOGY.md](METHODOLOGY.md) — prompts, scoring, integrity rules
- 📜 Decisions & rationale: [DECISIONS.md](DECISIONS.md) · Backlog: [BACKLOG.md](BACKLOG.md) · Ops: [OPS.md](OPS.md)
- 🔐 Pre-registration: each stage's predictions are hashed (SHA-256) and the hash committed + tagged before kickoff (`data/hashes/`)

## How it works

1. **Group stage:** every model got one identical prompt with all 72 group fixtures → strict-JSON scorelines. Training knowledge only — no live data, no odds.
2. **Self-consistent brackets:** from each model's own scorelines we computed *its own* group tables, qualifiers and third-place slotting (FIFA's official Annexe C table) → its own Round of 32 — which it then predicted round by round through to *its own champion*. No real result is involved anywhere; the entire tournament was collected and SHA-256 pre-registered **before the opening kickoff**.
3. **Scoring:** group matches — exact score 3 · correct goal difference 2 · correct outcome 1. Brackets — scored against the real tournament as it unfolds: points for every real team a model had reaching each stage (R32 1 · R16 2 · QF 3 · SF 5 · final 8 · champion 13), +1 for each simulated pairing that actually occurs in that round, and matched pairings' scorelines scored like normal matches (on the 90-minute result, +1 for the correct advancer).
4. Everything — raw API responses, predictions, results, scores — is in this repo and on the site. Scores are recomputed from primary data on every build.

## Repo layout

```
data/            fixtures, teams, roster, results, predictions, raw API logs, hashes
lib/             scoring engine, standings, validation, prompt builder, data loaders
scripts/         predict (group runner), simulate (bracket sims), record-result, hash, audit, make-knockout-fixtures
app/             Next.js site (static export)
tests/           scoring/standings/validation/fixture-invariant tests
```

## Commands

```powershell
npm test                                   # the whole test suite (CI runs this too)
npm run predict -- --stage group           # group-stage predictions (needs OPENROUTER_API_KEY in .env)
npm run simulate                           # per-model bracket simulations (R32 -> final), all pre-kickoff
npm run hash -- --stage all                # canonical SHA-256 for pre-registration
npm run result -- 1 2-1                    # record a real result (+ prints points per model)
npm run knockout-fixtures -- --stage r32   # materialize REAL knockout fixtures (for bracket scoring)
npm run audit                              # re-derive everything from raw logs, verify
npm run build                              # static site -> ./out
firebase deploy --only hosting             # publish ./out to punditbench.web.app
```

## Status

- [x] Methodology, scoring engine + tests, fixture data (two independent source sets, reconciled)
- [x] Runner + audit pipeline rehearsed end-to-end (mock)
- [x] Predictions locked & pre-registered — 40 models, group stage + full brackets; hashes tagged (`predictions-group(-v2)`, `predictions-full-tournament(-v2/-v3/-v4)`)
- [x] Site live at **https://punditbench.com** (Firebase Hosting, static export)
- [ ] Scored against reality as matches are played — tournament in progress

## Security

**"Isn't that a Google API key in `lib/site.ts`?"** Yes — and it's meant to be public. It's a Firebase *browser* key, which is a client identifier, [not a secret](https://firebase.google.com/docs/projects/api-keys): it ships in the site's JavaScript by design. Its only job is the cookieless page-view counter, and the enforced boundaries are: the key is restricted in Google Cloud to the Firestore API only (verified — it gets 403 on every other Google service), and [`firestore.rules`](firestore.rules) let anyone read the counters and do nothing except `+1` them on an allowlisted set of counter IDs; every other read, write, create and delete is denied, and the project has no billing attached. (A referrer restriction is also configured on the key, but Firestore does not enforce referrer checks — security rules, not the referrer list, are the real boundary. Worst-case abuse is inflating a page-view number.)

No private keys, service-account credentials, or model API keys live anywhere in this repo or its history. The one real secret — `OPENROUTER_API_KEY` — is read from an untracked `.env` (see [`.env.example`](.env.example)) and is never committed.

*PunditBench is an independent project, not affiliated with FIFA or any federation. Tournament and team names are used editorially. Statistics & entertainment only — not betting advice. All predictions are AI-generated content.*
