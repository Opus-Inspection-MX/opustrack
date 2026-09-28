# Initial-load workbooks: private preparation plan

**Decision:** Prepare reviewable, local-only CSV extracts from three private workbooks; do not import them into a database, run a seed, push or upload them, or grant access based on workbook labels. This is a plan, not an extraction or authorization to provision accounts.

## Source inventory and boundaries

| Private source in `initial_load/` | Inspected structure | Proposed ignored output |
| --- | --- | --- |
| Personnel workbook | 24 source rows across three groups: 15 field-service, 5 administrative, 4 managerial. These are source rows, not a verified unique-account count. | `initial_load/users.csv` for candidate identities and source categories; no inferred credentials or grants. |
| Vacation workbook | Eight period sheets containing historical aggregate balances; headers, spacers, and incomplete rows require filtering. | `initial_load/vacation-balances.csv` for candidate per-person, per-period aggregates and source provenance. |
| Vehicle workbook | 10 vehicle rows; assignment is free text rather than a user foreign key. | `initial_load/vehicles.csv` for candidate fleet records and reviewed assignment links. |

The personnel workbook is in **`initial_load/`**, not `docs/`; any reference to `docs/` as its source location is incorrect. Both trees are protected against accidental Excel/CSV additions by `.gitignore`. An ignore rule does not remove a file that was previously tracked: the tracked-file audit is a separate gate. `initial_load/reconciliation.csv` will hold private unmatched or ambiguous candidates, never a public issue list.

## Safe work sequence

1. **T1 — protection (this work unit):** install ignore rules for Excel workbooks and every CSV under both trees; audit tracked files and synthetic ignore paths before writing any CSV. Review only the public plan and safe diff. Do not read workbook records into logs, commits, tests, docs, or Engram.
2. **T2 — private preparation (not started):** read the three local workbooks as data only; do not execute macros. Extract candidate users, vacation period balances, and vehicles to ignored CSVs in `initial_load/` with private source-sheet/row provenance. Keep reconciliation exceptions in the ignored CSV. Use synthetic fixtures for tests, not copied workbook rows.
3. **T3 — human review (not started):** authorized personnel and vacation owners check identity matches, period meaning and totals, role categories, and vehicle assignments against the private sources. Record approvals/blockers only as redacted counts and categories in public evidence. Unresolved or conflicting matches block downstream use.

| Human reviewer | Required decision before downstream use |
| --- | --- |
| Personnel/identity owner | Confirm unique people, account eligibility, and any role grants; sheet labels alone confer no access. |
| Vacation policy owner | Confirm person-to-period matches, historical aggregate interpretation, and whether any balance correction is appropriate. |
| Fleet owner | Confirm vehicle identifiers and free-text assignee matches with the identity owner. |
| Authorized ROOT owner | Explicitly authorize any separately scoped owner provisioning; approval of extracts does not authorize account creation or database changes. |

## Reconciliation and validation gate

- Compare source-row counts by sheet and category with output and exception counts; detect skipped/incomplete rows, duplicates, and missing required fields. Check numeric balance and vehicle-year integrity; check period labels/dates only where the source supports them. Preserve original private values only in ignored outputs.
- Match vacation rows to personnel candidates by name with normalized comparison plus human confirmation. Match vehicle free-text assignment to a verified person and FSR role only after review. Do not silently select one of multiple matches, infer a role from job title, or treat a missing match as an empty assignment without review. Track unmatched, duplicate, and ambiguous links privately.
- The eight vacation sheets contain **aggregate period balances**, not dated absence requests. Do not create `Vacation` start/end dates or approved requests from them. `VacationPeriod` balances are derived in the current schema, not stored as a simple remaining-days field; human review must decide if and how historical figures could map to period overrides before any separate implementation or import.
- Keep workbook categories as **review hints**, not `UserRole` grants. No email, password, permission, or ROOT account may be inferred or generated from a name or source sheet. The owner is not a workbook row: provision any owner ROOT account only after explicit authorization in a separately scoped operation, never as part of this extraction.

## Stop conditions and evidence

No seed, `scripts/generate-seed-data.ts`, database initialization/import, remote transfer, push, upload, or public publication is part of T1–T3. The existing generator produces credentials and ROOT grants from personnel categories; it is not a safe substitute for this review. Even after human approval, any database or account operation requires separate explicit authorization.

T1 evidence: `git check-ignore -v --no-index` on synthetic paths; `git ls-files` audit for tracked Excel/CSV files; `git diff --check` and a sensitive-data review of the public diff. T2 adds focused unit tests and `npm run check` for new code plus redacted reconciliation totals. T3 requires an explicit human review decision; a blocked row stays blocked. Never include names, emails, plates, workbook cell values, or credentials in tracked artifacts or commit output.
