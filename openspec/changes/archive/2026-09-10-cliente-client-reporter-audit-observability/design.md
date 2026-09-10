# Design: Cliente → Client / Reporter / Audit / Observability

## Technical Approach

Bottom-up atomic renames (schema → client → helpers → scopes → actions → routes → pages → tests last), then two additive phases. PR1 renames only non-JWT-crossing identifiers; PR2 moves every JWT-crossing string with the single `sessionVersion` bump; PR3 adds audit; PR4 adds the logger + 403/500 split. RENAME-only per `20260508032555`, `--create-only`, generated SQL discarded.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| RENAME-only migration vs DROP+CREATE | Hand-enumerated indexes/constraints vs data loss (`20260609000000` anti-pattern) | RENAME-only; `@@unique([userId,clienteId])` → `[userId,clientId]`, compound key `userId_clienteId` → `userId_clientId` |
| Permission/Role UPDATEs in PR1 vs PR2 | PR1 avoids re-login but JWT carries permission names; changing them early locks users out | PR1 moves zero JWT strings; PR2 moves permissions + JWT claim `clienteId`→`clientId` + `SCOPE_ALL_CLIENTES` value + `route:client` + role `CLIENT`→`REPORTER` with the one `sessionVersion` bump (spec ADDED-2) |
| Explicit actor stamping vs AsyncLocalStorage | Verbose call sites vs silent `null` actors across Server-Action/`$transaction` boundaries | Explicit: caller passes `actorId` from `requirePermission`/`requireAction`; ALS rejected |
| `logAudit(tx, input)` single writer vs inline creates | Inline is faster to write vs unenforceable allowlist/append-only | Single writer modeled on `logIncidentEvent(tx, …)`: accepts tx client, allowlist keys never-PII (spec auditoria:31) + DENY set (RF-556), tx-scoped so rollback reverts audit (truncation limit deferred to tasks) |
| Stdlib edge-safe logger vs pino/winston | Less structure vs zero `deps:freeze` churn + Edge-safe (`console` + `crypto.randomUUID` only) | `src/lib/observability/logger.ts`: `debug\|info\|warn\|error`, `LOG_LEVEL` (prod default `info`, dev `debug`), dotted event names, JSON-line prod / pretty dev |

## Data Flow

```
Server Action / Route ──requirePermission──→ actor {id}
        │ tx                                    │
        ├─ domain write (createdById/updatedById/deactivatedAt/deactivatedById)
        └─ logAudit(tx, {actorId, entity, entityId, action, payload}) ──→ AuditLog
Route handler ──withPermission──→ 403 denial (no error log) │ 500 fault → logger.error(redacted)
instrumentation.ts onRequestError ──→ logger (sole framework→log bridge; digest reused, unknown normalized)
```

`rejected()`/BusinessRuleError never logs (returned rules, not defects). `guarded()` defect branch logs `action.defect` then rethrows.

## File Changes

| File | Action | Description |
|---|---|---|
| `prisma/migrations/XXXX_rename_cliente_to_client/migration.sql` | Create | RENAME list below (Sec. Migration); `--create-only`, discard generated SQL |
| `prisma/schema.prisma` | Modify | `Cliente`→`Client`, `UserClienteAssignment`→`UserClientAssignment`, `ScheduleCliente`→`ScheduleClient`, `clienteId`→`clientId` (Incident/Line/junctions), `UserProfile.createdAt` add, `Client.updatedAt @updatedAt` fix, audit columns, `AuditLog` + enums |
| `src/lib/utils/cliente-assignments.ts` (+test) | Rename+modify | → `client-assignments.ts`; 9 fns (spec renames:14 says 8; code has 9): `getUserClientes`, `getUserClienteIds`, `getPrimaryCliente`, `getPrimaryClienteId`, `userHasAccessToCliente`, `assignUserToCliente`, `removeUserFromCliente`, `setPrimaryCliente`, `getClienteUsers` → English equivalents |
| `src/lib/authz/authz.ts`, `src/lib/auth/filters.ts`, `src/lib/auth/report-scope.ts` | Modify | `SCOPE_ALL_CLIENTS`, `getClientWhereClauseAsync`/`canAccessClientAsync`/`assertClientAccessAsync`, `ReportScope.clientIds`, `scopeIncludesClient`; `clientIds`→`reporterIds` collision fix where it means CLIENT-user ids |
| `src/lib/actions/clientes.ts` | Rename+modify | → `clients.ts`; `reporterIds`, `getReporterUsers`, `fsrCountByClient`, `by:["clientId"]`, `revalidatePath("/admin/clients…")` |
| `src/app/admin/clientes/`, `/api/clientes`, `cliente-form.tsx` | Rename | → `clients` paths; DOM ids `clienteId`/`bulk-cliente-switch` → English |
| `src/lib/audit/log-audit.ts`, `src/lib/observability/logger.ts`, `redact.ts` | Create | Single writer + logger + denylist (see Contracts) |
| `instrumentation.ts`, `src/lib/auth/auth.ts`, `src/lib/actions/result.ts`, `biome.json`, `next.config.ts` | Modify | `onRequestError` bridge; 403/500 split (denial debug-only, fault `logger.error`); `noConsole` error with overrides for observability/scripts; redirects `/admin/clientes/:path*`→`/admin/clients/:path*`, `/api/clientes/:path*`→`/api/clients/:path*` (spec renames:17), `/client/:path*`→`/reporter/:path*` |
| `initial_load/seed.example.ts`, `e2e/*`, `src/test/*`, validations, menu | Modify | Last; CSV dual header (`cliente` legacy / `client` new, `client` wins; snapshot `clientId`; resolution accent/case-insensitive per spec renames:64-68); menu label stays "Cliente" |

## Interfaces / Contracts

Denylist (spec auditoria:98): `password`, `token`, `secret`, `authorization`, `cookie`, `sessionToken`, plus PII extensions (email/rfc/companyName/phone/contact/address/lat/lng/gps/photoUrl/filePath/blobUrl/reporterName/description/notes), case-insensitive substring, recursive, `[REDACTED]`.
```ts
// src/lib/audit/log-audit.ts — tx-scoped, modeled on logIncidentEvent
type AuditAction = "CREATE"|"UPDATE"|"DEACTIVATE"|"ASSIGN"|"UNASSIGN";
export async function logAudit(tx: TxClient, input: {
  actorId: string | null; entity: AuditEntity; entityId: string;
  action: AuditAction; payload?: Record<string, unknown>;
}): Promise<void>;
// logger: logger.info/warn/error(event: dotted-name, ctx?: unknown)
```

Audit matrix: 4 columns on every soft-deletable domain model; exclusions `IncidentEvent`, `ActionIdempotency`, `Notification`, `AuditLog`; no backfill (`null` = system). Append-only by unit test (RF-219 pattern), no triggers. RF-219's 5 routes emit zero `AuditLog`.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | RENAME parity, `vi.mock` paths, allowlist/DENY/truncation, redact fixture, append-only, RF-219 no-double-write | Vitest, keep 75% gates |
| Integration | `guarded`/`withPermission` 403-vs-500 matrix, `sessionVersion` single-bump re-login, CSV dual header | Ephemeral DB only |
| E2E | Ephemeral-DB lane incl. `scripts/db-prod.mjs:84` fixture mirror | Never real DB (`db-guard`) |

Tsc-invisible checklist: permission literals, query keys `clienteId`/`clienteIds`→`clientId` + `clientIds`→`reporterIds`, `prisma[model]` dynamic keys, DOM ids, CSV headers, `revalidatePath` args, fixtures/scripts.

## Threat Matrix

N/A — no shell/subprocess/VCS/executable boundary. Path moves use `next.config.ts` redirects; JWT rename gated by `sessionVersion` bump.

## Migration / Rollout

RENAME statements: 3 tables, `clienteId`→`clientId` columns (UserClientAssignment, ScheduleClient, Incident, Line); all `*_clienteId_*` indexes/keys and `Cliente_pkey/code_key` → `Client_*`; FK constraints renamed per table. PR2-only: `UPDATE Permission` (`clientes:`→`clients:`, `route:client`→`route:reporter`, `scope:all-clientes`→`scope:all-clients`) + `UPDATE Role` (`CLIENT`→`REPORTER`, `defaultPath`→`/reporter`) + `sessionVersion + 1`. Replacement longest-match-first, excluding `*-client.tsx`, `"use client"`, `PrismaClient`/`TransactionClient`, history, `TRANSLATION_REPORT.md`. `spec/02-clientes-jerarquia.md` filename KEPT per spec renames:4 (identifiers inside renamed, file not renamed). New modules imported same commit (knip).

5-PR slices (amends proposal:32-39 4-PR plan: PR1 ~130-file atomic rename exceeds 400-line review budget, so split into PR1a + PR1b): PR1a schema+migration+helpers+scopes; PR1b actions+routes+pages; PR2 REPORTER+JWT+bump+redirects; PR3 audit; PR4 logger+split+`console.*` migration. Rollback reverse 4→1b→1a (re-rename + second bump for PR1a/PR1b/PR2).

## Open Questions

- Confirm `UserClienteAssignment` physical index/constraint names via `\d` before finalizing SQL (Prisma defaults assumed).
- Next step: ready for sdd-tasks.
