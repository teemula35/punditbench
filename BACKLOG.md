# PunditBench — LLM World Cup 2026 Prediction Benchmark — Backlog

**Idea:** Every participating LLM predicts the result of every match of the 2026 World Cup, stage by stage: all 72 group-stage matches in one prompt before the tournament starts, then — once real pairings are known — one prompt per knockout round (R32 → R16 → QF → SF → Bronze+Final). Predictions are scored against real results and published on a public webapp.

**Created:** 2026-06-10 · **Updated:** 2026-06-10 (ownership delegated to Claude; decisions recorded in `DECISIONS.md`)

---

## 0. Status snapshot (updated 2026-06-11, pre-kickoff)

**D9 design change (user):** self-consistent bracket simulation — every model predicts its own knockout tree from its own group results, all collected before kickoff. Consequences: Epic G's five knockout prompt windows are **obsolete** (ops = results entry + deploy only); scoring extended with bracket components; site v2 adds per-model predicted group tables + bracket trees and a champion board. Roster final: **40 models / 19 vendors** (incl. legacy + oddball wings; 4 format-incapable models removed pre-kickoff per operator decision — every ranked model carries a complete tournament). GA4+consent shipped (disabled until `GA_MEASUREMENT_ID` set — needs your `G-…` ID). See DECISIONS.md D9 / CHANGELOG.md.

### Original snapshot (2026-06-10)

**Delegation:** Claude executes Epic 0 (D1–D4, D6, D8 decided — see DECISIONS.md), all of Epics A, B, C, E, G, and Epic D except D-1.
**Parked (you, separately):** Epic F (brand/content/launch — you, tomorrow) · Epic H (post-tournament — you, later).
**Still yours, blocking:**

| # | What only you can do | Blocks | When |
|---|---|---|---|
| 1 | **OpenRouter account + API key** (`OPENROUTER_API_KEY` in `.env`) + a few € credits | A5 full prediction run + A6 hash — **the kickoff deadline item** | **Today** |
| 2 | D7: publishing entity (personal vs Clarity AI Oy) | Imprint text on legal page only | Whenever |
| 3 | Buy domain `punditbench.com` (~15 €, confirmed unregistered) | Custom URL only — site is already live at https://punditbench.web.app (Firebase Hosting, free tier); map domain in Firebase console after purchase | Tomorrow OK |
| ~~4~~ | ~~D-1: GCP project + billing~~ | No longer blocks anything — hosting moved to Firebase free tier; GCP/Cloud Run path stays available in `.github/workflows/deploy.yml` if ever wanted | Optional |

---

## 1. Hard constraints (the tournament calendar owns this project)

| Event | Dates | Consequence |
|---|---|---|
| Opening match (MEX–RSA, Azteca) | **June 11** | Group-stage predictions locked **before kickoff** |
| Group stage (72 matches) | June 11–27 | Daily results entry + scoring; site launches in this window |
| Round of 32 (16) | June 28 – July 3 | Bracket final only after last group match → **prompt run night of June 27** |
| Round of 16 (8) | July 4–7 | Prompt run night of July 3 |
| Quarter-finals (4) | July 9–11 | Prompt run July 7–8 |
| Semi-finals (2) | July 14–15 | Prompt run July 11–13 |
| Bronze / Final | July 18 / **July 19** | Combined prompt run July 15–17 |

48 teams, 12 groups, top two + 8 best thirds advance, **104 matches** (72 + 32). FIFA official match numbers 1–104 are the canonical IDs.

**Golden integrity rule:** a prediction counts for a match only if created (timestamped) before that match's kickoff.

---

## 2. Milestones

- **M0 — Predictions in the vault** (before opening kickoff): roster run done, raw responses stored, SHA-256 hash published. ⛔ *Only blocker: your OpenRouter key.*
- **M1 — Soft launch** (June 12–15): public site live with leaderboard/match/model pages.
- **M2 — Knockout-ready** (by June 26): stage runner rehearsed, ops calendar set, scoring audited.
- **M3 — Marketing push** (~June 18+): Epic F — yours.
- **M4 — Final & wrap-up** (July 19+): Epic H — yours.

---

## 3. Backlog

**Owner:** `C` = Claude (agent work, end-to-end) · `C+you` = Claude does it, needs your key/credential/approval · `YOU` · `PARKED`.
**Prio:** P0 before kickoff · P1 public MVP · P2 before knockouts · P3 later.

### Epic 0 — Day-0 decisions → all made, see DECISIONS.md

| ID | Decision | Outcome |
|---|---|---|
| D1 | Scoring system | **Decided:** exact 3 / goal-diff 2 / outcome 1; knockout +1 for advancing team, scored on 90' result. Tiebreaks: pts → exacts → matches-with-points → advance hits |
| D2 | Model roster + params | **Decided:** ~14 models, flagship + small per major vendor, IDs verified against live OpenRouter catalog (agent running); temp 0 where supported, n=1, snapshots + cutoffs recorded; roster frozen after group run |
| D3 | API route | **Decided:** OpenRouter single integration; no `:online`/tool variants; raw chat completions only |
| D4 | Prompt + format | **Decided:** one identical prompt per stage, fixture list with official match numbers → strict JSON; knockout prompts include actual results so far; template versioned (`v1`) |
| D5 | Failure policy | **Default adopted (veto if you disagree):** ≤3 attempts with validator feedback, then 0 pts for affected matches, fully disclosed; no post-kickoff retries |
| D6 | Name + domain | **Decided: PunditBench** — punditbench.com (unregistered as of today; you buy) |
| D7 | Publishing entity | **OPEN — YOU** (only affects imprint text) |
| D8 | Stack | **Decided (revised):** static-first — Next.js static export, data as versioned JSON in git (git = admin UI + audit trail + backup), scoring computed at build, deploy Cloud Run/any static host via GitHub Actions. **No database** for MVP — at ~2 000 read-only rows a DB is over-engineering; revisit only if interactive features appear |

### Epic A — Prediction runner & integrity

| ID | Item | Prio | Owner | Note |
|---|---|---|---|---|
| A1 | Runner CLI (`predict --stage --models --mock`) | P0 | C | |
| A2 | Canonical fixture data (teams, 72 group fixtures, knockout bracket template) | P0 | C | Built from Wikipedia, independently cross-verified against ESPN/Sky by a second agent; diff reconciled |
| A3 | OpenRouter adapter + full raw request/response audit log (JSONL), params/usage/cost captured | P0 | C | |
| A4 | Strict validation (every match exactly once, int goals 0–15, knockout `advances` consistency) + bounded retries | P0 | C | |
| A5 | Smoke test (2 models) → full roster group run | P0 | **C+you** | ⛔ needs `OPENROUTER_API_KEY` |
| A6 | Pre-registration: SHA-256 of canonical predictions, published before kickoff | P0 | **C+you** | Hash computed + committed + pushed to public GitHub repo by Claude; you may additionally tweet it (Epic F) |
| A7 | Knockout stage-runner rehearsal (placeholder fixtures) | P2 | C | `make-knockout-fixtures` + mock run |
| A8 | Per-model cost/latency stats | P2 | C | Captured in audit log, shown on model pages |
| A9 | METHODOLOGY.md + site methodology page | P1 | C | |
| A10 | Baselines (odds favourite, Elo, random, 2-1-home) | P3 | C | Later turn |
| A11 | Consensus "silicon crowd" row | P3 | C | Later turn |

### Epic B — Data model, scoring, results

| ID | Item | Prio | Owner | Note |
|---|---|---|---|---|
| B1 | Data layer: typed JSON files (`teams`, `fixtures/*`, `roster`, `predictions/*`, `results`) — no DB per D8 | P1 | C | |
| B2 | Scoring engine, pure functions + unit tests (exact/GD/outcome, draws, knockout advances, missing, voided) | P1 | C | Test suite is the credibility gate |
| B3 | Deterministic recompute on every build (scores never stored, always derived) | P1 | C | |
| B4 | Results: manual-first `record-result` CLI (zero accounts needed); auto-fetch evaluation (football-data.org vs API-Football) researched by agent — adopt later if worth it | P1 | C | Auto-fetch would need a data-API key from you — optional |
| B5 | Admin = git: results edited via CLI + committed; full history/auditability | P1 | C | |
| B6 | Edge cases: voided/abandoned matches policy implemented | P2 | C | |
| B7 | Group-qualifier bonus | P3 | — | OFF (decided) |

### Epic C — Webapp

| ID | Item | Prio | Owner | Note |
|---|---|---|---|---|
| C1 | Next.js + Tailwind scaffold, static export, flag emojis, zero FIFA assets | P1 | C | |
| C2 | Leaderboard (totals, exact/GD/outcome/advance counts, sortable) | P1 | C | |
| C3 | Match pages ×104 (all predictions vs result, points) | P1 | C | |
| C4 | Model pages (all predictions, running total, hits/misses, params, cutoff) | P1 | C | |
| C5 | Matches browser + group tables | P1 | C | |
| C6 | Upcoming matches with locked predictions | P1 | C | |
| C7 | Methodology + About/FAQ pages | P1 | C | |
| C8 | OG/share images | P2 | C | Later turn (needs non-static image gen — small service or pre-rendered) |
| C9 | Points-race chart | P2 | C | Later turn |
| C10 | Mobile/a11y/SEO basics | P2 | C | Basics in v1; polish later |
| C11 | Public data export (JSON copied into site at build) | P2 | C | |
| C12 | Head-to-head compare | P3 | C | Later |
| C13 | Changelog page | P3 | C | CHANGELOG.md rendered |

### Epic D — Infra & DevOps

| ID | Item | Prio | Owner | Note |
|---|---|---|---|---|
| D-1 | ~~GCP project + billing~~ — obsoleted by Firebase Hosting free tier | — | — | Cloud Run workflow kept as optional alternative |
| D-2 | ✅ Hosting live: **https://punditbench.web.app** (Firebase Hosting, project `punditbench`); deploy = `npm run build; firebase deploy --only hosting` | P1 | C | Done 2026-06-10. Optional later: `firebase login:ci` token as GH secret for auto-deploy on push |
| D-3 | ✅ punditbench.com live (bought 2026-06-11; DNS at Namecheap; apex + www→apex redirect on Firebase Hosting; SITE_URL flipped) | P1 | C+you | Done 2026-06-11 |
| D-4 | ✅ GitHub repo (public, github.com/teemula35/punditbench) + Actions CI | P1 | C | Done 2026-06-10 |
| D-5 | Error tracking/uptime | P1 | C | Static site → uptime ping + CI status suffice for MVP; Sentry only if dynamic parts appear |
| D-6 | Backups | P1 | C | git history is the backup (D8); GitHub = offsite copy |
| D-7 | CDN/cache verification | P2 | C | Static export is CDN-native |
| D-8 | ✅ Analytics: GA4 (G-K2LKDM8LH5) behind a Consent Mode v2 banner — user's choice over the cookieless rec; verified in Realtime | P2 | C+you | Done 2026-06-11 |

### Epic E — Legal & policy

| ID | Item | Prio | Owner | Note |
|---|---|---|---|---|
| E1 | "Not betting advice" disclaimer in footer + about | P1 | C | |
| E2 | Trademark hygiene (no FIFA marks anywhere; editorial naming only; renameable brand) | P1 | C | Enforced in design |
| E3 | Privacy (no cookies/accounts → minimal) + imprint | P1 | C+you | Imprint entity = D7, placeholder until you decide |
| E4 | Provider ToS check re: published comparisons | P2 | C | Agent researching → LEGAL-NOTES.md |

### Epic F — Brand, content & launch — **PARKED: you, starting tomorrow**

F1 logo · F2 X account + hash post · F3 launch round · F4 matchday content · F5 pre-final content · F6 press. (Claude's A6 git-based hash publication covers integrity until your F2 post.)

### Epic G — Tournament operations

| ID | Item | Prio | Owner | Note |
|---|---|---|---|---|
| G1 | Ops calendar: 5 knockout prompt windows + commands | P1 | C | OPS.md; windows can be /scheduled once repo+key exist |
| G2 | Daily routine (~15 min): record results → rebuild → glance | P1 | C+you | CLI makes it ~3 commands/day; you (or a scheduled agent) run them |
| G3 | Incident runbook | P2 | C | OPS.md |
| G4 | Post-group audit (recompute from raw, diff) | P2 | C | `audit` script ready; run June 27 |

### Epic H — Post-tournament — **PARKED: you, after July 19**

H1 wrap-up report · H2 dataset publication · H3 archive · H4 retro/v2.

---

## 4. Out of scope for MVP

User accounts/human predictions · live scores · i18n · comments · betting-odds content · native apps · any database or k8s.

## 5. Top risks

1. **Missing kickoff** — only remaining blocker is the OpenRouter key (status table §0).
2. **Scoring bug** → B2 tests, B3 derive-always, G4 audit, C13 changelog.
3. **Provider failure in a tight window** → D5 policy, A7 rehearsal, OpenRouter rerouting.
4. **Bad fixture/result data** → two-source A2 verification, record-result prints per-match points for eyeball check.
5. **Hidden web access in a model** → no `:online` variants, raw completions only, documented.
6. **FIFA trademark complaint** → E2 hygiene, renameable brand.
7. **Cost surprise** → ~10–50 € LLM total, hosting ~0 € (static), domain 15 €.
