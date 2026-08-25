# Public PunditBench repository rules

This repository is public. It is the immutable evidence record for PunditBench and
contains the frozen 2026 World Cup benchmark plus the currently operating league
fixture, lock, result and scoring pipeline.

- Read `OPS.md`, `METHODOLOGY.md` and the applicable decision notes before changing
  operational or integrity-sensitive behavior.
- Never edit a locked prediction, raw response, manifest or hash; never rewrite,
  move or delete a prediction tag; never backfill a missed prediction.
- `data/roster.json` and the World Cup record are frozen. Current league work uses
  `data/roster-league.json` and the competition tree, subject to the same lock rules.
- Do not stop or remove current league automation without explicit owner approval
  and verified confirmation that no live consumer still depends on it. Preserve all
  existing league history even after new public league operations cease.
- Do not add private commercial implementation, current paid forecast cards, private
  prompts/model responses, model-performance weights, calibration parameters or
  proprietary calculation logic. Do not add strategy, roadmaps, backlogs or TODOs,
  including in branch names, commit messages or pull-request text.
- Do not commit secrets, credentials, customer data or private-repository artifacts.
- Use `--dry-run` for prediction/lock inspection. `--mock` writes lock artifacts and
  is not a safe rehearsal.
- Run `npm test`, `npx tsc --noEmit` and the appropriate non-deploying build before
  committing. Deployments, main-branch merges and tags remain operator-controlled.
