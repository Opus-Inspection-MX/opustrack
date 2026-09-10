# Tasks: Cliente → Client / Reporter / Audit / Observability

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1800–2500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema+migration+helpers+scopes | PR1a | `vitest run src/lib/utils/client-assignments.test.ts` | `test:e2e` ephemeral DB | Re-rename migration; revert schema/helpers |
| 2 | Actions+routes+pages+CSV | PR1b | `vitest run src/lib/actions` | `test:e2e` ephemeral DB | Revert `clients.ts`, routes, pages |
| 3 | REPORTER+JWT+bump+redirects | PR2 | `vitest run src/lib/auth` | Reporter login, one re-login | Re-rename + second bump |
| 4 | Logger+403/500 split | PR3 | `vitest run src/lib/observability` | 403 then 500 via API | Remove logger; revert `biome.json` |
| 5 | Audit columns+writer | PR4 | `vitest run src/lib/audit` | `test:e2e` ephemeral DB | Drop `AuditLog`; remove columns |
| 6 | Hardening: shared param constant, `vi.mock` audit, drift-check proof | PR3/PR4 follow-up | `vitest run src/lib/auth` + drift check | Param round-trip via API | Revert constant to literal; unconfigure shadow DB |

Threats: N/A.

## Phase 1: PR1a schema + helpers + scopes

- [x] 1.1 `\d` index/constraint names; write RENAME-only `prisma/migrations/XXXX_rename_cliente_to_client/migration.sql` (`--create-only`)
- [x] 1.2 `prisma/schema.prisma`: `Cliente`→`Client`, junctions, `clienteId`→`clientId`, `userId_clientId`, `UserProfile.createdAt`, `Client.updatedAt @updatedAt`
- [x] 1.3 `src/lib/utils/cliente-assignments.ts` → `src/lib/utils/client-assignments.ts` (9 fns to English)
- [x] 1.4 `src/lib/authz/authz.ts`, `src/lib/auth/filters.ts`, `src/lib/auth/report-scope.ts` to English; `clientIds`→`reporterIds` for CLIENT-user ids
- [x] 1.5 Fix 7 `vi.mock` paths + `npm run check`; old JWT stays valid

## Phase 2: PR1b actions + routes + pages

- [x] 2.1 `src/lib/actions/clientes.ts` → `src/lib/actions/clients.ts` (`reporterIds`, `getReporterUsers`, `fsrCountByClient`, `by:["clientId"]`)
- [x] 2.2 `src/app/admin/clientes/` → `src/app/admin/clients/`, `src/app/api/clientes/` → `src/app/api/clients/`, rename `cliente-form.tsx`; English DOM ids
- [x] 2.3 Longest-match-first; skip `*-client.tsx`, `"use client"`, `PrismaClient`, history; cover tsc-invisible keys/fixtures/scripts
- [x] 2.4 CSV dual header (`cliente`/`client`, `client` wins; snapshot `clientId`); accent/case-insensitive test
- [x] 2.5 `seed.example.ts`, `e2e/fixtures/`, `src/test/`; keep `02-clientes-jerarquia.md`; `npm run check` + `test:unit`

## Phase 3: PR2 REPORTER + JWT + redirects

- [x] 3.1 `UPDATE Permission` + `UPDATE Role` (`REPORTER`, `/reporter` (read-only)) with one `sessionVersion` bump; verify one re-login (pre-PR2 JWT → `null` once)
- [x] 3.2 JWT `clienteId`→`clientId`; `src/app/client/`→`src/app/reporter/`; menu, `routePaths`, `reporter@` seeds
- [x] 3.3 `next.config.ts` redirects (`/admin/clientes` (read-only), `/api/clientes` (read-only), `/client` (read-only)); `/api` (read-only) redirect test

## Phase 4: PR3 observability (RF-555–557) — resequenced before audit

Resequence note (finding e): PR3/PR4 labels explicitly swapped — the old PR4 (logger + 403/500 split) ships first because it fixes a live defect (handler faults masked as 403), while audit is a gap with no live breakage. Old Phase 4 content moved to Phase 5 below.

- [x] 4.1 `src/lib/observability/logger.ts` + `src/lib/observability/redact.ts` (denylist+PII, `[REDACTED]`); import in entry path (knip)
- [x] 4.2 `src/lib/auth/auth.ts` split: denial → 403 unlogged; fault → 500 + `logger.error`; `result.ts` rules unlogged; `instrumentation.ts` `onRequestError` → logger. FIRST audit every `toBe(403)` assertion (`src/app/api/incidents/route.test.ts:101,128`, `src/app/api/schedules/incidents/route.test.ts:277` — 3 known): `src/lib/auth/auth.ts:293-310` catches everything to 403 today, so the split changes the 403 body and moves handler defects 403→500; update expectations before splitting
- [x] 4.3 Migrate `console.*` in `src/`; `biome.json` `noConsole` error (overrides: observability/scripts); PII (RF-556) + 403/500 (RF-557) tests

## Phase 5: PR4 audit (RF-550–554) — resequenced after observability (was PR3)

- [x] 5.1 Attribution columns on soft-deletable models; exclude `IncidentEvent`, `ActionIdempotency`, `Notification`, `AuditLog`; no backfill
- [x] 5.2 `src/lib/audit/log-audit.ts`: `logAudit(tx,…)` single writer, tx-scoped, explicit `actorId`
- [x] 5.3 Payload cap 4096 + `…[TRUNCATED]`; allowlist + DENY in writer; unit test
- [x] 5.4 Stamp actors; append-only, closed-enum, RF-219 zero-log, RF-553 tests; rollback 5→4→3→2→1b→1a

## Phase 6: Pending hardening from design review (all pending, ride with PR3/PR4)

- [x] 6.1 Shared constant for the `clientIds` query-param pair: `src/lib/reports/incident-program/query-params.ts` (`INCIDENT_PROGRAM_CLIENT_IDS_PARAM`) imported by both `src/app/admin/reports/incident-program/incident-program-client.tsx` (writer) and `src/app/api/reports/incident-program/route.ts` (reader); `query-params.test.ts` proves writer and reader agree
- [x] 6.2 Audit 7 `vi.mock()` paths (not 5): all 7 mock `@/lib/utils/client-assignments` (the real helper path; zero `cliente-assignments` references remain) and provide `getUserClientIds`, which the real module exports — no stale paths, no fixes needed
- [ ] 6.3 Drift-check validation — PARTIAL (wiring done, live proof pending): `shadowDatabaseUrl = env("SHADOW_DATABASE_URL")` in `prisma/schema.prisma`, `npm run db:drift` script, `SHADOW_DATABASE_URL` defaults in `config/e2e.env` + `.env.example`, ephemeral proof script `scripts/drift-proof.mjs` (`db:drift:proof` / `e2e:drift:proof`). Green + negative-test proof requires Docker (unavailable in this environment); prove in the e2e lane, then check this box. Proof step: `npm run e2e:drift:proof`
