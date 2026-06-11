# Delta for Incidentes (Domain 03)

> Change: `incident-type-priority` | RF range: RF-200–RF-249 | Spec file: spec/03-incidentes.md

---

## MODIFIED Requirements

### Requirement: RF-213 · Catálogos de incidentes (tipos y estados)

The system MUST maintain `IncidentType` and `IncidentStatus` catalogs administrable via CRUD in the configuration section.

`IncidentType` MUST include a `priority` field: an integer from 1 to 10, NOT NULL, representing the operational importance of incidents of that type. The field is mandatory — every `IncidentType` record MUST have a priority value within the valid range.

(Previously: `IncidentType` had no priority field; the table defined only `id`, `name`, `description`, and `active`.)

**Rules:**

- `IncidentType.priority` MUST be an integer in the closed range [1, 10]. Values outside this range MUST be rejected.
- The Zod validation schema for `IncidentType` MUST enforce `min(1).max(10)` on the `priority` field.
- The admin MUST be able to set and update `priority` when creating or editing an `IncidentType`.
- The type `"Desconocido"` (system fallback) MUST have a defined priority (seed value); it is NOT exempt from the validation rule.
- Inactive types and states MUST NOT appear in creation/editing forms (existing rule — unchanged).
- The `"Desconocido"` type MUST remain protected against deletion (existing rule — unchanged).
- `IncidentStatus` catalog rules are unchanged.

#### Scenario: Admin sets a valid priority when creating an IncidentType

- GIVEN the admin is creating a new `IncidentType`
- WHEN the admin submits the form with `priority = 7`
- THEN the record is saved with `priority = 7`
- AND the type appears in the catalog with its numeric priority badge

#### Scenario: Admin sets a valid priority when editing an IncidentType

- GIVEN an existing `IncidentType` with `priority = 5`
- WHEN the admin edits the type and changes `priority` to `9`
- THEN the record is updated with `priority = 9`

#### Scenario: Validation rejects priority below 1

- GIVEN the admin is editing or creating an `IncidentType`
- WHEN the admin submits `priority = 0`
- THEN the operation is rejected with a validation error indicating the value must be between 1 and 10
- AND no record is created or updated

#### Scenario: Validation rejects priority above 10

- GIVEN the admin is editing or creating an `IncidentType`
- WHEN the admin submits `priority = 11`
- THEN the operation is rejected with a validation error indicating the value must be between 1 and 10
- AND no record is created or updated

#### Scenario: Priority badge visible in the IncidentType catalog table

- GIVEN at least one `IncidentType` with a defined `priority`
- WHEN the admin views the catalog table
- THEN each row displays the numeric priority value as a badge

---

## ADDED Requirements

### Requirement: RF-214 · Priority field on IncidentType — migration and seed

The database schema MUST include `IncidentType.priority Int NOT NULL`. The migration MUST apply a default value of `5` to all existing rows at migration time. The seed script MUST overwrite all seeded `IncidentType` records with their actual intended priority values (not the migration default).

**Rules:**

- The migration MUST use an `ALTER TABLE ... ADD COLUMN priority INT NOT NULL DEFAULT 5` approach (or equivalent Prisma migration) so that the column is added without violating the NOT NULL constraint on existing rows.
- The seed script MUST assign a specific priority to every `IncidentType` it manages, including `"Desconocido"`.
- Post-migration, every row in `incident_types` MUST have a `priority` value between 1 and 10.

#### Scenario: Migration runs on a database with existing IncidentType rows

- GIVEN a database with 5 existing `IncidentType` rows, none with a `priority` column
- WHEN the Prisma migration is applied
- THEN all 5 rows have `priority = 5`
- AND new rows created after the migration require an explicit `priority` value

#### Scenario: Seed assigns real priorities to incident types

- GIVEN a freshly migrated database
- WHEN the seed script runs
- THEN each seeded `IncidentType` has its specific priority value (not the migration default of 5)
- AND `"Desconocido"` has a defined priority (not left as the default unless that is the intentional value)

---

### Requirement: RF-215 · Critical priority threshold constant

The system MUST define a single constant `CRITICAL_PRIORITY_THRESHOLD = 8` in a dedicated constants module (`src/lib/constants/`). An incident is considered **critical** if and only if its associated `IncidentType.priority >= CRITICAL_PRIORITY_THRESHOLD`.

**Rules:**

- The threshold value MUST NOT be hardcoded inline in queries or components; all consumers MUST reference the constant.
- No label (e.g., "Alto", "Crítico") is derived from the threshold — only the numeric comparison matters.

#### Scenario: Type with priority at threshold is critical

- GIVEN an `IncidentType` with `priority = 8` (equal to `CRITICAL_PRIORITY_THRESHOLD`)
- WHEN the system evaluates whether incidents of that type are critical
- THEN the result is `true` (critical)

#### Scenario: Type with priority below threshold is not critical

- GIVEN an `IncidentType` with `priority = 7` (below `CRITICAL_PRIORITY_THRESHOLD`)
- WHEN the system evaluates whether incidents of that type are critical
- THEN the result is `false` (not critical)

---

### Requirement: RF-216 · Priority badge visibility across surfaces

The numeric priority value MUST be visible as a badge in the following four surfaces:

| Surface | Location |
|---------|----------|
| IncidentType catalog table | Column in the admin catalog table (RF-213) |
| Incident list views | Badge next to the incident type or title in admin/FSR/client list views |
| Tracking view | Badge on each incident row in `/admin/tracking` (RF-513) |
| Reports | Priority value included in incident-related report output (RF-503, RF-504) |

**Rules:**

- The badge MUST display the numeric value (1–10). Color coding by range is a design decision and is outside this spec's scope.
- The badge MUST be present on every incident row where the type has a defined `priority`.
- No label text (e.g., "Crítico") is added alongside the badge number.

#### Scenario: Priority badge in incident list

- GIVEN a list of active incidents where each incident has a `type.priority` defined
- WHEN a user views the list
- THEN each incident row shows its numeric priority badge

#### Scenario: Priority badge in tracking view

- GIVEN the admin opens `/admin/tracking` with one or more incidents loaded
- WHEN the incidents are rendered
- THEN each incident row includes the numeric priority badge sourced from `type.priority`
