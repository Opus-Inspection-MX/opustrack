# Initial-load workbooks — ODD task tracker

**Status:** T1 completed (public safety plan only); T2–T3 pending. **Branch:** `feat/initial-load-workbooks`.
**Public plan:** `docs/plans/initial-load-workbooks.md`.
**Boundary:** Local, private workbook-to-CSV preparation only. No database import, seed execution, remote upload, or publication of source workbooks or extracts.

## Execution contract

| Field | Decision |
| --- | --- |
| Route | Delegated implementation, not executed by this tracker. Evidence: work spans the public plan and `.gitignore`, a local extractor and focused tests, several private CSV outputs, and a human reconciliation gate; preparation and validation are nontrivial. |
| Mode | Standard; strict TDD disabled by `openspec/config.yaml` (`testing.strict_tdd: false`, `phases.apply.strict_tdd: false`). Add focused tests alongside code, not as a separate later unit. |
| Verification | For code changes: focused `npm run test:unit` plus `npm run check` (scripts verified in `package.json`); run ignore and private-output checks before writing any extract. Report exact results without private row values. |
| Delivery | `ask-on-risk` per `openspec/config.yaml`. Forecast ~360–600 authored changed lines across T1 (~60–110), T2 (~260–400), and T3 (~40–90), excluding private generated data; estimates must be remeasured. The cumulative total may exceed the 400-line review budget: ask before choosing a chained PR strategy, and do not open a PR or perform any remote operation without explicit authorization. |
| Local commits | Plan one cohesive work-unit commit per completed task on this branch, with safe documentation, ignore rules, code, and synthetic tests together where applicable. Inspect staged paths before any commit; never stage source workbooks or generated private CSVs. The user authorized only a local T1 commit, not a push. |

## Tasks

### T1 — Safety boundary and public plan [completed]

- [x] Write `docs/plans/initial-load-workbooks.md` with local-only extraction scope, output categories, validation, review gates, and explicit no-import/no-upload rules; use abstract role categories, never workbook cell values.
- [x] **Before generating any CSV**, update `.gitignore` to cover `initial_load/*.xlsm` and **all** `initial_load/*.csv` (including reconciliation exceptions), retaining the existing workbook/seed protections. Audit `git ls-files` for any already-tracked private inputs/outputs; ignore rules alone cannot hide tracked files.
- [x] Verify the ignore patterns with `git check-ignore -v --no-index` against synthetic `.xlsm` and each planned CSV basename, and review the public diff for sensitive values. Preserve existing `.atl` modifications and the untracked workbook.

**Exit:** Public plan and ignore rules reviewed; all planned private output names match ignore rules before extraction; no private inputs or outputs staged. **Evidence:** seven requested synthetic paths match `.gitignore`; two nested-path checks and existing `seed.ts`/`.xlsx` protections pass; `git ls-files -z` reports 0 tracked `.xlsx`/`.xlsm`/`.csv` files in the repository; `git diff --check` passes. T1 changes are limited to `.gitignore`, this tracker, and `docs/plans/initial-load-workbooks.md`; commit identity is reported separately after commit.

### T2 — Local private CSV extraction and validation [pending; depends on T1]

- [ ] Prepare a local-only extractor with synthetic-fixture tests; read workbooks as data without executing macros. Produce separate ignored CSVs for users, vacation balances/periods, vehicles, and reconciliation exceptions under `initial_load/`.
- [ ] Preserve source provenance without copying personal values into the public plan, tests, logs, or commits. Validate required fields, duplicates, numeric/date integrity, per-sheet and per-category counts, cross-file joins, and vehicle assignment links. Route missing or ambiguous joins to a private exceptions CSV rather than guessing.
- [ ] Treat vacation totals as aggregates and period candidates, not dated requests; do not invent historical requests, emails, credentials, permissions, or authoritative role grants. Role categories from source sheets are hints for human review, never automatic superuser assignments. Do not run the existing generator or seed path as a substitute for this review.
- [ ] Run focused unit tests and `npm run check` for code changes; check that every output remains ignored and no sensitive row appears in staged or public artifacts. Keep private output validation local and report only redacted counts and exception categories.

**Exit:** Local extracts and exceptions exist only after T1 safety checks; deterministic synthetic tests and integrity/reconciliation checks pass or report unresolved records without fabricating data. **Evidence:** test/check results, aggregate counts, exception categories, safe-file diff, and local work-unit commit identity only after authorization and completion.

### T3 — Human approval gate [pending; depends on T2]

- [ ] Present redacted reconciliation totals and role-category mapping for a human to review in the local secure context; resolve ambiguous people, period interpretations, and vehicle links against authorized source material without copying private values into tracked artifacts or Engram.
- [ ] Record approval or unresolved blockers using only abstract categories and counts. No seed use, DB import, or publication before explicit human approval and a separate, scoped authorization for that operation.
- [ ] Recheck the public diff and staged paths. Keep any private review notes and generated CSVs ignored and local.

**Exit:** Explicit review outcome documented without private values; unresolved ambiguities remain blocked. **Evidence:** redacted approval/blocker summary, safe-file list, and local work-unit commit identity only if a safe work unit is actually committed.

## Progress and rollback

T1: completed (documentation and ignore checks only) · T2: pending · T3: pending. No code tests (no code change), extraction, seed, database import, or remote operation performed. Runtime harness: N/A; no runtime boundary in T1.

- **T1 rollback:** Revert only the public plan and new ignore-rule changes; do not remove pre-existing ignore rules or touch private inputs.
- **T2 rollback:** Revert only new safe extractor/test files and delete local private outputs with the operator's approval; retain T1 protections.
- **T3 rollback:** Revert only the safe review summary; keep prior protection and validation work intact.
