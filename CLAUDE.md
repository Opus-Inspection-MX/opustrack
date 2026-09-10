# CLAUDE.md

Guidance for AI assistants working in this repository. The domain specs in
`spec/` are the source of truth for business rules; this file covers how the
code is organized and which commands to run.

## Project Overview

OpusTrack is an incident management and work-order tracking system for vehicle
inspection **Clientes** in Mexico. Next.js 15 (App Router), Prisma,
NextAuth (credentials + JWT), PostgreSQL, shadcn/ui + Tailwind 4.

| Term | Code | Notes |
|------|------|-------|
| Cliente | `Cliente` | Inspection center. Central tenant unit (multi-tenant scoping). |
| State | `State` | Mexican state, geographic level above Cliente. |
| Línea / Equipo | `Line` / `Equipment` | Inspection line and physical equipment inside a Cliente. |
| Incidente | `Incident` | Reported failure. Status is **derived** from its assignments (except cancel). |
| Asignación | `Assignment` | Work order an FSR executes. One incident → many assignments. |
| FSR | role | Field technician. Executes assignments and vehicle trips. |
| AssignmentItem | `AssignmentItem` | Free-text parts/equipment used + cost. **Not inventory**: no catalog, no stock. |
| Viaje | `VehicleTrip` | Vehicle run with odometer + photo + GPS. |
| Programación | `Schedule` | Calendar linking Clientes and incidents. |

## Development Commands

```bash
npm run dev          # Full stack in Docker: database + Next server (hot reload)
npm run dev:host     # Next on the host, database still in Docker
npm run stack:down   # Stop the stack
npm run build        # Production build — this is what Vercel runs
npm start            # Production server
```

```bash
npm run check        # biome + tsc + knip (unused files fail CI) — must stay clean
npm run format       # Format with Biome (writes changes)
npm run test:unit    # Vitest, 75% thresholds
npm run test:e2e     # Playwright against an ephemeral Docker DB (never the real one)
```

```bash
npm run db:up        # Start the local Postgres container
npm run db:init      # Migrate, then seed ONLY if the database is empty
npm run db:migrate   # Create a new migration
npm run db:studio    # Open Prisma Studio
npm run db:reset     # Drop and rebuild from scratch
```

**Safety**: every `db:*` command refuses non-local hosts
(`scripts/lib/db-guard.ts`). Production lives on Neon, managed from Vercel.

**Seed**: `scripts/db-init.ts` runs `initial_load/seed.ts` when the DB is
empty (gitignored real data); the tracked template is
`initial_load/seed.example.ts`. There is no `prisma/seed.ts`. After schema
changes run `npm run db:migrate` to regenerate the Prisma client.

Seeded roles (`defaultPath`): **ROOT** (`/admin`, `isSuperuser`),
**ADMIN_OPERACION** (`/admin/tracking`), **ADMIN_VACACIONES**
(`/admin/vacations`), **FSR** (`/fsr`), **EMPLEADO** (`/vacations`),
**CLIENT** (`/client`), **GUEST** (`/guest`). Test users follow
`{role}@opusinspection.com` / `password123` (e.g. `admin@`,
`fsr@`, `client@`, `guest@`, three accounts per main role).

## Architecture

### Multi-role RBAC (database-driven)

- A user holds **many roles** via `UserRole` — there is deliberately no
  `roleId` scalar on `User`. Use `whereHasRole()` / `whereHasPermission()`
  (`src/lib/authz/user-queries.ts`), never a role-name comparison.
- `isSuperuser` (ROOT only) bypasses every route and permission check. It is
  **not** "sees every Cliente": cross-Cliente data scope is the
  `scope:all-clientes` permission (`SCOPE_ALL_CLIENTES`), so an operations
  admin sees all centers without holding the keys to roles.
- JWT carries `roleNames[]`, `isSuperuser`, `defaultPath`, `routePaths[]`,
  `exactRoutePaths[]`, `sessionVersion`, `clienteId`. Middleware
  (`src/middleware.ts`, Edge Runtime, no DB) enforces routing with
  `canAccessRoute()` (`src/lib/authz/route-access.ts`); tokens predating
  `routePaths` force re-login. API routes and pages re-check against the DB.
- Multi-Cliente scoping: `getReportScope()` + `*ScopeWhere()` in
  `src/lib/auth/report-scope.ts`. Fail closed — no Cliente assignment means
  matching nothing. No sync single-Cliente helpers exist; everything is async.

### Auth helpers (`src/lib/auth/auth.ts`)

| Helper | Use |
|--------|-----|
| `requireAuth()` | API routes / actions needing a user |
| `requirePermission(name)` / `requireAction(res, act)` | Fine-grained checks (throw on deny) |
| `requireRouteAccess(path)` | Pages (redirects) |
| `withPermission(name, handler)` | API route wrapper (403 on deny) |
| `canPerform()` / `getMyAccessibleRoutes()` | Conditional UI in Server Components |

### State machines own status

`src/lib/state-machine/` (assignment + incident machines, `syncIncidentState`).
Incident status derives from active assignments; `CANCELADA` is terminal and
set only by `cancelIncident()`. Never write `statusId` from a generic form —
route edits through the machines (see `updateAssignmentDetails`,
`updateIncidentDetails` in `src/lib/actions/tracking.ts`).

### Business rules are RETURNED, never thrown

Production Next strips the message of anything a Server Action throws. Use
`src/lib/actions/result.ts`:

- `return rejected("…")` for rules on the straight-line path.
- `businessRule("…")` inside `guarded(...)` for shared guards and
  `prisma.$transaction` callbacks (only throwing rolls back).
- Spanish message = operator-facing (returned). English = defect (throws).
  Enforced by `actions-contract.test.ts`.

### Conventions

- **Soft delete everywhere**: `active: false`, validate no active children
  first (e.g. `deleteAssignment` also blocks on active `AssignmentItem`s,
  RF-250). Filter `where: { active: true }`.
- **Server Components + Server Actions first**; API routes only for
  high-interactivity screens (`/admin/programacion`, calendar signature
  endpoints). `revalidatePath()` every mutation (admin + role paths).
- Next.js 15: `await params` in dynamic routes.
- Prisma client always from `@/lib/database/prisma.singleton`.
- UI toasts via `@/hooks/use-toast`; never `alert()`.
- `knip --include files` runs in `npm run check`: no unused files allowed.

### File storage & email

- `FILE_STORAGE_PROVIDER`: `vercel-blob` (needs `BLOB_READ_WRITE_TOKEN`) or
  `filesystem`. Each attachment stores its provider
  (`src/lib/storage/file-storage.ts`).
- Without `SMTP_HOST` the app logs mail instead of sending (`src/lib/mail/`).
  Which events email is decided by the channel matrix
  (`NotificationChannelPolicy`, admin screen at
  `/admin/settings/notifications`); mail goes through `EmailOutbox` with
  retries (5 min, 30 min, 2 h; max 3 attempts). E2E proves delivery via Mailpit.

### Dependency supply chain

`.npmrc` carries a `before=` cutoff: npm refuses versions published after that
date. Run `npm run deps:freeze` (7-day window) before adding/updating a
dependency. Never float versions as a side effect of an unrelated install.

## Testing credentials

Seeded accounts (password `password123`): `admin@`, `fsr@`, `client@`,
`guest@` (+ numbered variants) `@opusinspection.com`.

## Where the domain lives

| Area | Spec |
|------|------|
| Rules cutting across domains | `spec/00-overview.md` |
| Auth, RBAC, sessions | `spec/01-auth-rbac.md` |
| Clientes, lines, equipment | `spec/02-clientes-jerarquia.md` |
| Incidents | `spec/03-incidentes.md` |
| Assignments, ODT, activities, items | `spec/04-asignaciones.md` + `spec/05-partes-inventario.md` |
| Vehicles, trips | `spec/06-vehiculos-viajes.md` |
| Schedules | `spec/07-programacion.md` |
| Notifications + email | `spec/08-notificaciones.md` |
| Reports, tracking, dashboard | `spec/09-reportes-tracking.md` |
| Holidays, vacations, accrual | `spec/10-festivos-vacaciones.md` |
