# Proposal: Cliente → Client / Reporter / Audit / Observability

## Intent

Spanish identifiers clash with English code; `CLIENT` names a tenant, not the reporter's function; mutations lack attribution; prod failures are undiagnosable (403/500 conflated, no PII-safe logging).

## Scope

### In Scope
- `Cliente→Client` (`clientId`, `UserClientAssignment`, `ScheduleClient`), `clients:*`, `/admin/clients` + `/api/clients`, RENAME migration.
- `CLIENT→REPORTER` (`/reporter`, `route:reporter`, `reporter@`) with `sessionVersion` bump.
- Audit columns + `AuditLog` writer; `IncidentEvent` untouched.
- Stdlib logger in `src/lib/observability/`, 403/500 split; spec identifiers→English, prose Spanish.

### Out of Scope
- Visual work; 13 `*-client.tsx`, `"use client"`, `PrismaClient`/`TransactionClient`/`EventClient`.
- Migrations history; `openspec/changes` history; `TRANSLATION_REPORT.md`.

## Capabilities

> No `openspec/specs/` exists; `spec/` is source of truth. New spec `11` covers RF-550–599.

### New Capabilities
- `audit-trail`: attributable mutations, single writer (spec 11).
- `observability-logging`: PII-safe logger, 403/500 split (spec 11).

### Modified Capabilities
- None (rename plus additive work; requirements unchanged).

## Approach

RENAME-only migration per `20260508032555` (never DROP+CREATE). Explicit actor stamping (ALS rejected). Zero-dependency logger. Four stacked PRs:

| PR | Unit |
|----|------|
| 1 | `Cliente→Client` atomic rename (~130 files) |
| 2 | `CLIENT→REPORTER` + `sessionVersion` bump |
| 3 | Audit columns + writer (additive) |
| 4 | Logger + 403/500 split (additive) |

Mandatory: rename colliding `clientIds` (CLIENT-user ids) to `reporterIds` in PR 1.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma`, migrations | Modified | RENAME tables/columns; `Permission`/`Role` UPDATEs |
| `cliente-assignments`, `filters`, `authz`, `report-scope` | Modified | Helper/permission/scope renames |
| Actions, pages, routes, seeds, e2e | Modified | `clients.ts`, `/admin/clients`, fixtures, seeds |
| `src/lib/observability/`, `instrumentation.ts` | New | Logger + error forwarding |
| `spec/` identifiers | Modified | English identifiers; Spanish prose kept |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Session lockout (JWT drift) | High | `sessionVersion` bump Phase 2 only; permission timing per exploration:59 |
| Data loss (DROP+CREATE) | Med | RENAME-only SQL; ephemeral-DB e2e |
| Gitignored `seed.ts` drift | Med | Document manual mirror of `seed.example.ts` |
| Coverage 75% / knip / biome | Med | Tests travel with renames; wire logger into entry path |
| `clientIds`→`reporterIds` collision | High | Mandatory rename in PR 1 |

## Rollback Plan

Revert reverse order (4→1). PR 1/2: re-rename migration + second `sessionVersion` bump. PR 3/4: remove additive code.

## Dependencies

- Ephemeral-DB e2e lane (never real DB); holder of gitignored `seed.ts` mirrors `seed.example.ts`.

## Success Criteria

- [ ] `npm run check` clean; unit tests pass at 75%; e2e green on ephemeral DB.
- [ ] Zero `clienteId`/`Cliente`/`CLIENT` identifiers outside out-of-scope list.
- [ ] Forced re-login works once (Phase 2); no lockout in Phases 1/3/4.
