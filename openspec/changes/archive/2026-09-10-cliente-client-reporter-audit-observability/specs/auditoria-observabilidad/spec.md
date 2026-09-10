# 11 · Auditoría y observabilidad

> Change: `cliente-client-reporter-audit-observability` | Spec nueva (destino: `spec/11-auditoria-observabilidad.md`, rango RF-550–599) | Índice y tabla de rangos de `spec/00` la registran en archive.

## Propósito

Toda mutación queda atribuida a un actor; un log de auditoría append-only (`AuditLog`) registra quién cambió qué, separado de la bitácora de estado de incidentes (RF-219, intacta); un logger estándar PII-safe con split 403/500 hace diagnosticables los fallos de producción.

## Modelo de datos

### Columnas de atribución (en todo modelo de dominio con soft delete)

| Campo | Tipo | Nulo significa |
|-------|------|----------------|
| `createdById` | String? (FK → User) | `null` = fila de sistema (seed, migración, backfill). Toda escritura vía Server Action con usuario autenticado MUST setearlo |
| `updatedById` | String? (FK → User) | `null` = nunca modificado tras la creación |
| `deactivatedAt` | DateTime? | `null` = activo (coherente con `active: true`) |
| `deactivatedById` | String? (FK → User) | `null` = activo o desactivación de sistema |

Relleno previo: `UserProfile.createdAt`, `Client.updatedAt @updatedAt`. EXCLUIDOS: `IncidentEvent`, `ActionIdempotency`, `Notification` (efímera, con `isRead`/`readAt` propios) y el propio `AuditLog`.

### AuditLog (append-only, sin soft delete)

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` / `createdAt` | CUID / DateTime | Inmutables |
| `actorId` | String? (FK → User) | Misma semántica de nulidad que arriba |
| `entity` | Enum cerrado | Modelos auditados (diseño enumera; extender requiere enmienda de spec) |
| `entityId` | String | PK de la fila afectada |
| `action` | Enum cerrado: `CREATE`, `UPDATE`, `DEACTIVATE`, `ASSIGN`, `UNASSIGN` | Vocabulario cerrado; sin eventos de estado (ver RF-553) |
| `payload` | Json? | Claves allowlist (ej. campos cambiados, motivo); nunca PII (ver RF-556) |

## Requisitos funcionales

### RF-550 · Atribución explícita en mutaciones

**Descripción:** Cada mutación de un modelo auditado registra su actor con las 4 columnas, sin propagación implícita de contexto.

**Reglas de negocio:**
- El actor se obtiene de `requirePermission`/`requireAction` (ya lo devuelven) y se pasa explícito a la escritura; AsyncLocalStorage queda rechazado (no propaga de forma fiable en Server Actions + `prisma.$transaction`; actores `null` silenciosos).
- `deactivatedAt`/`deactivatedById` se escriben en la misma operación que `active: false`.
- Sin backfill: las filas previas al despliegue conservan `null` (semántica de sistema).

### RF-551 · Escritor único `logAudit(tx, …)`

**Descripción:** Una sola función persiste filas de `AuditLog` dentro de la transacción del negocio.

**Reglas de negocio:**
- Firma explícita `{ actorId, entity, entityId, action, payload? }`; el caller SIEMPRE provee `actorId` (o `null` de sistema, nunca omitido).
- Si la transacción revierte, la auditoría revierte con ella (nada de escrituras fuera de `tx`).

### RF-552 · `AuditLog` append-only

**Descripción:** Bitácora de auditoría que solo crece.

**Reglas de negocio:**
- El código de aplicación NUNCA actualiza ni elimina filas (garantizado por test unitario, como RF-219; sin triggers de BD).
- `entity`/`action` son enums cerrados: un valor fuera del vocabulario falla validación, no se persiste.
- Sin backfill: los eventos nacen en el despliegue.

### RF-553 · Frontera con RF-219 (no-doble-escritura)

**Descripción:** `IncidentEvent` sigue siendo el único log de ocurrencias que afectan el estado del incidente; `AuditLog` registra gestión atribuible, nunca transiciones.

**Reglas de negocio:**
- `IncidentEvent` intacto: las 5 rutas RF-219 (transiciones de `syncIncidentState`, cancelación, reapertura, sync de habilitados, bulk-import) NO emiten `AuditLog`.
- Ediciones escalares de incidentes (título, descripción, prioridad…) y altas/bajas de catálogos SÍ van a `AuditLog`.
- `overrideIncidentStatus` (excepción de administrador) emite `ADMIN_OVERRIDE` en `IncidentEvent`; `AuditLog` no lo duplica.

#### Scenario: Cierre de incidente, un solo log

- GIVEN un incidente que se cierra por sincronización
- WHEN `syncIncidentState` emite `STATUS_CHANGED → CERRADO`
- THEN existe el evento en `IncidentEvent` y cero filas en `AuditLog` para esa transición

### RF-554 · Retención de auditoría

**Descripción:** La auditoría se conserva por defecto; purgar es decisión operativa explícita.

**Reglas de negocio:**
- El código de aplicación no expone ninguna ruta de borrado/purga de `AuditLog` (exento de soft delete).
- Toda purga/archivado futuro vive en runbook operativo, preserva el orden append-only y requiere enmienda de esta spec.

### RF-555 · Logger estándar (stdlib, edge-safe)

**Descripción:** `src/lib/observability/logger.ts` con `logger.info/warn/error`, sin dependencias nuevas.

**Reglas de negocio:**
- Nivel por `LOG_LEVEL` (defecto: `info` en prod, `debug` en dev); JSON a stdout en prod, legible en dev; sin `node:fs` (compatible Edge).
- Qué se loguea: fallos de handler (500), `onRequestError` de `instrumentation.ts`, denegaciones con contexto mínimo; NUNCA reglas de negocio devueltas (`rejected()`/`BusinessRuleError` no son errores).
- `console.*` prohibido en `src/` (regla Biome `noConsole`); scripts conservan el suyo.

### RF-556 · Redacción PII por denylist

**Descripción:** Ningún log contiene secretos ni datos personales directos.

**Reglas de negocio:**
- Denylist mínima: `password`, `token`, `secret`, `authorization`, `cookie`, `sessionToken` (+ claves que diseño agregue); coincidencia case-insensitive por subcadena en claves; valor redactado como `[REDACTED]`.
- La redacción se aplica recursiva en objetos y ANTES de serializar; un test unitario la cubre con un fixture adverso.

#### Scenario: Error con sesión adjunta

- GIVEN un fallo de handler cuyo contexto incluye `sessionToken` y `email`
- WHEN se emite `logger.error`
- THEN el token sale como `[REDACTED]` y el error conserva su traza útil

### RF-557 · Split 403/500 en `withPermission`/`withAction`

**Descripción:** Las denegaciones de autorización responden 403 sin log de error; solo los fallos genuinos del handler responden 500 y se loguean.

**Reglas de negocio:**
- Denegación (sin permiso, sin sesión válida para la ruta): 403 `{"error"}`, sin `logger.error` (debug opcional).
- Excepción del handler: 500 + `logger.error` con contexto redactado; `BusinessRuleError`/redirects de `result.ts` siguen su contrato (propagan, no loguean).
- `instrumentation.ts onRequestError` reenvía al logger (único puente framework→log).

#### Scenario: Distinguir ataque de bug

- GIVEN un request sin permiso y otro que revienta el handler
- WHEN ambos pasan por `withPermission`
- THEN el primero es 403 sin error logueado y el segundo 500 con `logger.error` redactado
