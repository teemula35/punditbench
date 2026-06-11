# PunditBench — LLM World Cup 2026 Prediction Benchmark — Backlog

**Idea:** 40 LLMs predict the entire 2026 World Cup before the opening kickoff — all 72 group-stage scorelines, and from each model's own predictions its own knockout bracket (group tables, FIFA tiebreakers, official Annexe C third-place slotting) through to its own champion. Everything is SHA-256 pre-registered, then scored against reality as the real tournament unfolds.

**Created:** 2026-06-10 · **Updated:** 2026-06-11 · Decisions and rationale in `DECISIONS.md`, methodology on the site.

---

## 0. Status snapshot (2026-06-11, pre-kickoff)

All build work is complete and the benchmark is frozen: **40 models / 19 vendors** (incl. legacy + oddball wings; models unable to produce valid prediction sets within the retry policy were removed before kickoff — every ranked model carries a complete tournament). Site live at **punditbench.com**. Remaining work for the next five weeks is operational: enter real results, materialize real knockout fixtures as rounds form, deploy.

---

## 1. Tournament facts

| Event | Dates |
|---|---|
| Opening match (MEX–RSA, Azteca) | **June 11** |
| Group stage (72 matches) | June 11–27 |
| Round of 32 (16) | June 28 – July 3 |
| Round of 16 (8) | July 4–7 |
| Quarter-finals (4) | July 9–11 |
| Semi-finals (2) | July 14–15 |
| Bronze / Final | July 18 / **July 19** |

48 teams, 12 groups, top two + 8 best thirds advance, **104 matches** (72 + 32). FIFA official match numbers 1–104 are the canonical IDs.

**Golden integrity rule:** every prediction in the system was generated and pre-registered before the opening kickoff; nothing anywhere depends on a real result.

---

## 2. Milestones — all reached pre-kickoff

- **M0 — Predictions in the vault:** full roster collected, raw responses stored, SHA-256 hashes tagged in this repo.
- **M1 — Site launch:** leaderboard, match, model, and group pages live.
- **M2 — Bracket simulations:** every model's own knockout tournament collected and locked.
- **M3 — Tournament operations** (ongoing): results entry + scoring through July 19.

---

## 3. Backlog

**Prio:** P1 core · P2 polish · P3 nice-to-have. ✅ = done.

### Epic 0 — Day-0 decisions (see DECISIONS.md for rationale)

| ID | Decision | Outcome |
|---|---|---|
| D1 | Scoring system | ✅ Group: exact 3 / goal-diff 2 / outcome 1, on the 90' result. Brackets: advancement per real team reaching each stage (R32 1 · R16 2 · QF 3 · SF 5 · final 8 · champion 13), +1 per simulated pairing that occurs, matched scorelines scored like normal matches |
| D2 | Model roster + params | ✅ Flagship + small per major vendor, later expanded with mid-tier, legacy and oddball wings; IDs verified against the live OpenRouter catalog and live-pinged; temp 0 where supported, n=1; roster frozen at kickoff |
| D3 | API route | ✅ OpenRouter single integration; no `:online`/tool variants; raw chat completions only |
| D4 | Prompt + format | ✅ One identical prompt per stage → strict JSON; knockout prompts carry only the model's own predicted tournament context |
| D5 | Failure policy | ✅ ≤3 attempts with validator feedback; models unable to produce valid sets across repeated pre-kickoff cycles were removed from the ranked roster (raw attempts published in `data/raw/`) |
| D6 | Name + domain | ✅ PunditBench — punditbench.com |
| D7 | Publishing entity / imprint | Pending — site shows "Publisher: to be announced" |
| D8 | Stack | ✅ Static-first: Next.js static export, data as versioned JSON in git (git = admin, audit trail and backup), scoring derived at build. No database — ~2 000 read-only rows |

### Epic A — Prediction runner & integrity — ✅ complete

| ID | Item | Note |
|---|---|---|
| A1–A5 | Runner CLI, fixture data, OpenRouter adapter, strict validation, full roster runs | Fixtures built from Wikipedia and independently cross-verified against ESPN/Sky; raw request/response JSONL audit logs published |
| A6 | Pre-registration | Hashes committed + tagged before kickoff (`data/hashes/`, tags `predictions-*`) |
| A7–A9 | Bracket simulation pipeline, cost/latency stats, methodology page | `npm run simulate`; per-model cost shown on model pages |
| A10 | Baselines (odds favourite, Elo, random) | P3 — open idea |
| A11 | Consensus "silicon crowd" leaderboard row | P3 — open idea (per-match consensus already shown) |

### Epic B — Data model, scoring, results — ✅ complete

| ID | Item | Note |
|---|---|---|
| B1–B3 | Typed JSON data layer; scoring engine as pure functions + test suite; deterministic recompute on every build | The test suite is the credibility gate |
| B4–B5 | Results entry via CLI (`npm run result`), committed to git | Auto-fetch from a results API evaluated (LEGAL-NOTES.md); manual-first kept |
| B6 | Voided/abandoned match policy | Implemented |
| B7 | Group-qualifier bonus | Decided OFF |

### Epic C — Webapp

| ID | Item | Status |
|---|---|---|
| C1–C7 | Scaffold, leaderboard, 104 match pages, model pages with predicted group tables + bracket trees, groups, methodology/about | ✅ |
| C8 | OG/share images per match/model | P2 — site-wide OG card done; per-page cards open |
| C9 | Points-race chart | P2 — open |
| C10 | Mobile/a11y/SEO | ✅ basics + mobile pass |
| C11 | Public data export (`/data/*.json`) | ✅ |
| C12 | Head-to-head model compare | P3 — open |
| C13 | Changelog page | ✅ |

### Epic D — Infra & DevOps — ✅ complete

| ID | Item | Note |
|---|---|---|
| D-2 | Hosting | Firebase Hosting, static export; `npm run build; firebase deploy --only hosting` |
| D-3 | Domain | punditbench.com (apex + www redirect), TLS auto-managed |
| D-4 | GitHub repo + Actions CI | Tests + build on every push |
| D-5 | Monitoring | Static site: uptime ping + CI status suffice |
| D-6 | Backups | Git history; GitHub as offsite copy |
| D-7 | CDN/cache | Static export is CDN-native; security headers incl. enforcing CSP |
| D-8 | Analytics | GA4 behind a Consent Mode v2 opt-in banner, plus an independent cookieless page-view counter (no identifiers; Firestore rules allow only +1 increments) |

### Epic E — Legal & policy — ✅ complete

| ID | Item | Note |
|---|---|---|
| E1 | "Not betting advice" disclaimer | Footer + about |
| E2 | Trademark hygiene | No FIFA marks anywhere; tournament/team names used editorially only |
| E3 | Privacy + imprint | Privacy text mirrors actual behavior; imprint pending (D7) |
| E4 | Provider ToS review for published comparisons | LEGAL-NOTES.md |

### Epic F — Brand & content

Logo/wordmark, social presence and matchday content — tracked separately from this engineering backlog.

### Epic G — Tournament operations (June 11 – July 19)

| ID | Item | Note |
|---|---|---|
| G1 | Daily routine: record results → rebuild → deploy | ~3 CLI commands per match day (OPS.md) |
| G2 | Real knockout fixtures as rounds form | `npm run knockout-fixtures` — bracket points start paying out automatically |
| G3 | Incident runbook | OPS.md |
| G4 | Audits | `npm run audit` re-derives everything from raw logs; scheduled before knockouts and before the final |

### Epic H — Post-tournament (after July 19)

Wrap-up report · dataset publication · archive · retro.

---

## 4. Out of scope

User accounts/human predictions · live scores · i18n · comments · betting-odds content · native apps · any database or k8s.

## 5. Risks & mitigations

1. **Scoring bug** → pure-function engine with test suite, derive-always recompute, raw-log audits, public changelog.
2. **Bad fixture/result data** → two-source fixture verification; `record-result` prints every model's points per match for an eyeball check.
3. **Hidden web access in a model** → no `:online` variants, raw completions only, documented in methodology.
4. **Trademark complaint** → hygiene enforced (no marks, editorial naming only).
5. **Cost surprise** → ~11 € LLM total (all pre-kickoff), hosting ~0 € (static), domain ~15 €/yr.
