# Delta de renombres: Cliente → Client, CLIENT → Reporter (specs 00–10)

> Change: `cliente-client-reporter-audit-observability` | Alcance: solo identificadores en `spec/00–10`. Ningún RF cambia su comportamiento (la propuesta declara 0 capabilities modificadas en conducta): este delta es una tabla normativa de aplicación mecánica + 3 requisitos de borde.
> Destino en archive: búsqueda/reemplazo según la tabla; el archivo `spec/02-clientes-jerarquia.md` NO se renombra.

## RENAMED Requirements

**Razón (única):** los identificadores españoles chocan con el código en inglés; `CLIENT` nombra un tenant, no la función de reportar (pasa a `REPORTER`).

| Antes | Después | Fase | Migración / notas |
|-------|---------|------|-------------------|
| Modelo/tabla/tipo `Cliente` | `Client` | PR1 | SQL solo RENAME (precedente `20260508032555`); nunca DROP+CREATE |
| `clienteId` (columnas FK, keys de query/form, `@@unique`, `@@index`) | `clientId` | PR1 | Incluye `Incident`, `Line`, `UserClientAssignment`; `by: ["clienteId"]`, `select`/`where` |
| `UserClienteAssignment` (+ `userId_clienteId`) | `UserClientAssignment` (`userId_clientId`) | PR1 | 8 helpers → inglés (`getUserClientIds`, `assignUserToClient`, …) |
| `ScheduleCliente` (+ `@@id`) | `ScheduleClient` | PR1 | `syncScheduleClientes` → `syncScheduleClients` |
| Helpers de alcance (`getClienteWhereClauseAsync`, `canAccessClienteAsync`, `assertClienteAccessAsync`, `*ScopeWhere`, `scopeIncludesCliente`, `getFSRsByClienteId`, `getPrimaryClienteId`) | Equivalentes en inglés (`…Client…`) | PR1 | Incluye `ReportScope.clienteIds` → `clientIds` (entidad real: sin colisión) |
| `src/lib/actions/clientes.ts`, `/admin/clientes`, `/api/clientes`, `cliente-form`, ids DOM `clienteId`/`bulk-cliente-switch` | `clients.ts`, `/admin/clients`, `/api/clients`, `client-form`, ids en inglés | PR1 | `revalidatePath` y `routePaths` acompañan |
| `getClientUsers` (usuarios rol CLIENT), `fsrCountByCliente` | `getReporterUsers`, `fsrCountByClient` | PR1 | Ver colisión (ADDED-1) |
| Claim JWT `clienteId` (RF-100) | `clientId` | PR2 | Cruza el JWT: viaja con el bump (ADDED-2) |
| Permisos `clientes:*` + `resource: "clientes"` | `clients:*` + `resource: "clients"` | PR2 | `UPDATE Permission`, ids de `RolePermission` estables |
| `scope:all-clientes` / `SCOPE_ALL_CLIENTES` | `scope:all-clients` / `SCOPE_ALL_CLIENTS` | PR2 | Literales + constante juntos (el valor vive en el JWT) |
| `route:client` → `/client` | `route:reporter` → `/reporter` | PR2 | Con el rol; incluye menú "Mi Centro" y `revalidatePath("/client…")` |
| Rol `CLIENT`, cuentas `client@opusinspection.com` | `REPORTER`, `reporter@opusinspection.com` | PR2 | `defaultPath: "/reporter"` |
| CSV snapshot `clienteId` | `clientId` | PR1 | Template dual (ADDED-3) |

## ADDED Requirements

### Requirement: ADDED-1 · Colisión `clientIds` → `reporterIds`

`clientIds` hoy significa "ids de usuarios CLIENT" (`clientes.ts`, RF-151/152); tras el renombre se leería como "ids de centros". El sistema MUST usar `reporterIds` para ids de usuarios REPORTER en payloads, firmas y specs (RF-151/152/158).

#### Scenario: Creación con FSRs y reporters

- GIVEN un admin con `clients:create` que envía `fsrIds` + `reporterIds`
- WHEN ejecuta `createClient`
- THEN los FSR quedan con `isPrimary: false` y los reporters con `isPrimary: true` vía `assignUserToClient`

#### Scenario: Cero ambigüedad residual

- GIVEN el código tras PR1
- WHEN se busca `clientIds`
- THEN solo aparece donde significa centros reales (ej. `ReportScope.clientIds`, `clienteIds` de schedule → `clientIds`)

### Requirement: ADDED-2 · Timing de nombres de permiso vs `sessionVersion`

Los strings que viajan en el JWT (nombres de `Permission`, nombre de `Role`, claim de alcance) MUST cambiar solo en PR2, junto a UN único bump de `sessionVersion` (RF-102). PR1 (schema + código que no cruza el JWT) MUST NOT requerir re-login. Contingencia (exploration:59): si diseño halla un string JWT que deba moverse en PR1, el bump se mueve con él.

#### Scenario: PR1 sin lockout

- GIVEN un JWT emitido antes de PR1
- WHEN se despliega PR1
- THEN la sesión sigue válida (los strings del token no cambiaron)

#### Scenario: PR2 con re-login único

- GIVEN un JWT pre-PR2
- WHEN se despliega PR2 (renombres + bump)
- THEN el primer request retorna `null`/re-login y el siguiente login ya emite `REPORTER` + `clients:*`

### Requirement: ADDED-3 · CSV dual-header `cliente`/`client` (RF-206)

El modo template (encabezados en español) MUST aceptar `cliente` (legacy) o `client` (nuevo); si vienen ambos, `client` precede. El modo snapshot (IDs en inglés) usa `clientId`.

#### Scenario: Plantilla legacy sigue cargando

- GIVEN un Excel template con columna `cliente` (código)
- WHEN se importa tras PR1
- THEN resuelve igual que antes (búsqueda insensible a tildes/mayúsculas)

## Falsos amigos (MUST NOT renombrar)

13 `*-client.tsx` (`*-report-client`, `notifications-page-client`, …), 147 `"use client"`, `PrismaClient`/`TransactionClient`/`EventClient`, historial de migraciones, `openspec/changes/**`, `TRANSLATION_REPORT.md`, prosa española ("desde el cliente" 08:211 = navegador; "componentes cliente" 09:22/406 = Client Components; 06:79/332; "cliente reporta" en 00 = prosa, se conserva).

## Docs fuera del sistema de specs (checklist para apply, no deltas)

- [ ] `CLAUDE.md` (tabla Cliente→Client, rutas, `scope:all-clients`, REPORTER)
- [ ] `README.md` si nombra centros/roles
- [ ] `openspec/config.yaml` (context: `Domain: Cliente` → `Client`)
- [ ] Espejo manual del `seed.ts` gitignored (quien lo posea replica `seed.example.ts`)
