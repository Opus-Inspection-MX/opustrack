# 03 · Incidentes

> OpusTrack — especificación de dominio. Índice: spec/README.md

## Propósito

Modela el ciclo de vida completo de un incidente en un Centro de Verificación Vehicular: desde su reporte inicial hasta su cierre o cancelación. El incidente es la entidad central del sistema: origina asignaciones de trabajo para FSRs, se vincula a líneas y equipos, y su estado es calculado automáticamente desde el estado de sus asignaciones hijas.

---

## Modelo de datos

### Incident

| Campo              | Tipo                     | Notas                                                              |
|--------------------|--------------------------|--------------------------------------------------------------------|
| id                 | Int (PK)                 | Autoincrement                                                      |
| title              | String                   | Título descriptivo del incidente                                   |
| description        | String                   | Descripción detallada                                              |
| typeId             | Int (FK → IncidentType)  | Tipo del incidente; NOT NULL — fallback a "Desconocido" automático |
| statusId           | Int? (FK → IncidentStatus)| Estado actual; solo la máquina de estados lo modifica             |
| reportedAt         | DateTime                 | Timestamp de creación (default: now())                             |
| startedAt          | DateTime?                | Fecha de inicio del trabajo; lo define el creador/editor           |
| resolvedAt         | DateTime?                | Seteado automáticamente por `syncIncidentState` al cerrar          |
| cancelledAt        | DateTime?                | Seteado por `cancelIncident` al cancelar                           |
| cancellationReason | String?                  | Motivo libre de cancelación; trimmeado, puede ser null             |
| clienteId          | String? (FK → Cliente)   | Centro al que pertenece el incidente; nullable                     |
| reportedById       | String? (FK → User)      | Usuario que reportó                                                |
| scheduleId         | String? (FK → Schedule)  | Programación vinculada; opcional                                   |
| lineId             | Int? (FK → Line)         | Línea afectada; solo disponible al crear desde rol CLIENT          |
| equipmentId        | Int? (FK → Equipment)    | Equipo afectado; solo disponible al crear desde rol CLIENT         |
| userId             | String?                  | FK legada mantenida por compatibilidad                             |
| assignments        | Assignment[]             | Asignaciones de trabajo (1:N)                                      |
| assignees          | IncidentAssignee[]       | FSRs habilitados para trabajar en el incidente (RF-025)            |
| active             | Boolean                  | Soft delete                                                        |

**Índices relevantes:** `(clienteId)`, `(statusId)`, `(typeId)`, `(reportedAt)`, `(active, reportedAt)`.

### IncidentAssignee (RF-025)

Tabla pivote que habilita a FSRs específicos para trabajar en un incidente. Independiente de las asignaciones concretas (`Assignment`).

| Campo      | Tipo              | Notas                                                            |
|------------|-------------------|------------------------------------------------------------------|
| id         | String (CUID, PK) |                                                                  |
| incidentId | Int (FK → Incident)|                                                                 |
| userId     | String (FK → User)|                                                                  |
| assignedAt | DateTime          | Timestamp de habilitación                                        |
| active     | Boolean           | Soft delete de la habilitación                                   |
| @@unique   | [incidentId, userId]| Evita duplicados                                               |
| @@map      | "incident_assignees"|                                                               |

### IncidentType

| Campo       | Tipo     | Notas                                                                                     |
|-------------|----------|-------------------------------------------------------------------------------------------|
| id          | Int (PK) |                                                                                           |
| name        | String   | Único. Ej.: "Falla Eléctrica", "Mantenimiento Preventivo"                                 |
| description | String?  |                                                                                           |
| priority    | Int      | NOT NULL. Rango cerrado [1, 10]. @default(5). Importancia operacional del tipo. RF-214.   |
| active      | Boolean  | Soft delete                                                                               |

El tipo `"Desconocido"` es de sistema y no puede eliminarse. Se usa como fallback cuando un incidente se crea sin tipo explícito.

**Umbral crítico:** Un incidente se considera crítico si `IncidentType.priority >= CRITICAL_PRIORITY_THRESHOLD (= 8)`. Esta constante vive en `src/lib/constants/incident-type.ts` y es la única fuente de verdad — no se hardcodea en consultas ni componentes. RF-215.

### IncidentStatus

| Campo  | Tipo     | Notas                                                   |
|--------|----------|---------------------------------------------------------|
| id     | Int (PK) |                                                         |
| name   | String   | Único. Valores: ABIERTO, ASIGNADO, VISTO, INICIADO, EN_PROGRESO, CERRADO, CANCELADA |
| color  | String   | Hex para badge de estado en UI                          |
| active | Boolean  | Soft delete                                             |

---

## Estados y transiciones

La máquina de estados del incidente se define en `src/lib/state-machine/incident-machine.ts`. El estado del incidente es **siempre derivado** de sus asignaciones hijas, con la única excepción de CANCELADA (acción directa de administrador).

### Tabla de estados

| Estado         | Color    | Significado                                                                 |
|----------------|----------|-----------------------------------------------------------------------------|
| ABIERTO        | #94A3B8  | Incidente recién reportado, sin asignaciones activas                       |
| ASIGNADO       | #8B5CF6  | Al menos una asignación existe y tiene FSR asignado                        |
| VISTO          | #06B6D4  | Al menos un FSR ha reconocido una asignación                               |
| INICIADO       | #3B82F6  | Se ha iniciado el trabajo en sitio                                         |
| EN_PROGRESO    | #F59E0B  | Trabajo en pausa o continuando; más de una asignación avanzando            |
| CERRADO        | #10B981  | Todas las asignaciones activas están en estado CERRADO                     |
| CANCELADA      | #EF4444  | Cancelado por administrador; estado terminal sin posibilidad de reapertura |

### Transiciones permitidas

| Desde \ Hacia   | ABIERTO | ASIGNADO | VISTO | INICIADO | EN_PROGRESO | CERRADO | CANCELADA |
|-----------------|---------|----------|-------|----------|-------------|---------|-----------|
| ABIERTO         | ✓       | ✓        |       |          |             |         | ✓         |
| ASIGNADO        | ✓ *     | ✓        | ✓     |          |             |         | ✓         |
| VISTO           |         | ✓ *      | ✓     | ✓        |             |         | ✓         |
| INICIADO        |         |          | ✓     | ✓        | ✓           | ✓       | ✓         |
| EN_PROGRESO     |         |          |       | ✓        | ✓           | ✓       | ✓         |
| CERRADO         |         |          |       |          | ✓ *         | ✓       |           |
| CANCELADA       |         |          |       |          |             |         | ✓ (solo)  |

\* Retrocesos posibles: ASIGNADO → ABIERTO (todas las asignaciones retiradas), VISTO → ASIGNADO, CERRADO → EN_PROGRESO (reapertura de asignación).

### Lógica de cálculo del estado (`syncIncidentState` + `computeIncidentStateFromAssignmentStates`)

1. Si el incidente ya está en CANCELADA → no se toca (short-circuit).
2. Se obtienen los estados de todas las asignaciones activas del incidente.
3. Si no hay asignaciones activas → ABIERTO.
4. Si **todas** las asignaciones activas están en CERRADO → el incidente pasa a CERRADO y se setea `resolvedAt = now()`.
5. En cualquier otro caso → se toman solo las asignaciones **no cerradas** y se proyecta cada una a su contribución al estado del incidente. Se selecciona la contribución de mayor rango.

**Mapa de contribución (AssignmentState → IncidentState):**

| Estado asignación      | Contribuye como estado incidente |
|------------------------|----------------------------------|
| PENDIENTE_DE_ASIGNACION | ABIERTO                         |
| ASIGNADO               | ASIGNADO                         |
| VISTO                  | VISTO                            |
| INICIADO               | INICIADO                         |
| EN_PROGRESO            | EN_PROGRESO                      |
| CERRADO                | CERRADO                          |

---

## Requisitos funcionales

### RF-025 · IncidentAssignee: FSRs habilitados por incidente

**Descripción:** Cada incidente tiene una lista de FSRs explícitamente habilitados para trabajar en él, independiente de las asignaciones de trabajo concretas. Esta lista se gestiona vía la tabla `incident_assignees` y se usa para filtrar qué FSRs pueden ver y operar el incidente en las vistas FSR.

**Reglas de negocio:**
- Un FSR removido de `IncidentAssignee` no puede ser retirado si tiene una asignación activa en ese incidente (bloqueado por `syncIncidentAssignees`, error explícito).
- La reconciliación es un diff: FSRs en la lista nueva que ya estaban quedan sin cambio; los que salen reciben `active: false`; los nuevos se crean.
- Solo usuarios con rol FSR activo pueden agregarse a `IncidentAssignee` (`updateIncidentFsrs` valida contra BD).
- Permiso requerido para modificar: `incidents:update`.

**Escenario crítico:** Bloqueo al retirar FSR con asignación activa
- DADO un incidente con FSR "A" en `IncidentAssignee` y "A" asignado a una `Assignment` activa del mismo incidente.
- CUANDO se intenta actualizar `assigneeIds` excluyendo a "A".
- ENTONCES la operación falla con: _"No se puede retirar a FSR(s) asignado(s) a una asignación activa: [userId]"_.

---

### RF-200 · Creación de incidente (rol ADMINISTRADOR o FSR)

**Descripción:** Los usuarios con permiso `incidents:create` pueden registrar un nuevo incidente, especificando título, descripción, tipo, Cliente, programación, FSRs habilitados iniciales, y fecha de inicio.

**Reglas de negocio:**
- Todo incidente nuevo inicia obligatoriamente en estado ABIERTO. El `statusId` provisto por el caller es ignorado.
- Si `typeId` no se proporciona o es null, se resuelve al tipo sistema "Desconocido" automáticamente (`resolveTypeIdOrFallback`).
- Si "Desconocido" no existe en el catálogo, la creación falla con error explícito.
- `reportedById` puede ser provisto por el caller (para imputar el reporte a otro usuario); si se omite, toma el usuario en sesión.
- `startedAt` es opcional y no afecta el estado inicial.
- Si se proveen `assigneeIds`, se crean los registros en `incident_assignees` con `skipDuplicates: true`.
- Permiso requerido: `incidents:create`.

---

### RF-201 · Creación de incidente (rol CLIENT)

**Descripción:** Los usuarios con rol CLIENT pueden reportar incidentes desde su Cliente asignado, opcionalmente indicando la línea y el equipo afectados.

**Reglas de negocio:**
- El `clienteId` del incidente se obtiene automáticamente del Cliente primario del usuario (`getPrimaryClienteId`); el caller no puede elegir otro Cliente.
- Si el usuario CLIENT no tiene un Cliente primario asignado (`isPrimary: true` en `UserClienteAssignment`), la creación falla con error: _"El usuario no tiene un Cliente asignado"_.
- Los campos `lineId` y `equipmentId` son opcionales y solo están disponibles en este flujo (no en el flujo admin).
- El estado inicial forzado es ABIERTO.
- Un usuario CLIENT solo ve los incidentes que él mismo reportó (`reportedById = user.id`).
- Permiso requerido: `incidents:create`.

---

### RF-202 · Cierre automático del incidente por asignaciones

**Descripción:** El estado del incidente se recalcula automáticamente cada vez que una asignación hija cambia de estado. Cuando todas las asignaciones activas pasan a CERRADO, el incidente pasa a CERRADO y se registra `resolvedAt`.

**Reglas de negocio:**
- `syncIncidentState` se llama desde `assignments.ts` tras cada mutación de estado de asignación.
- Si todas las asignaciones activas son CERRADO, el incidente pasa a CERRADO y `resolvedAt = now()`.
- Si alguna asignación es reabierta, el incidente puede retroceder de CERRADO a EN_PROGRESO.
- Si el incidente está en CANCELADA, `syncIncidentState` hace short-circuit y no modifica el estado.
- `resolvedAt` se setea a `null` si el incidente deja de estar CERRADO (reapertura).

**Escenario crítico:** Cierre automático
- DADO un incidente con 2 asignaciones activas; asignación A en CERRADO, asignación B en EN_PROGRESO.
- CUANDO la asignación B pasa a CERRADO.
- ENTONCES `syncIncidentState` detecta que todas las asignaciones son CERRADO, actualiza el incidente a CERRADO y setea `resolvedAt = now()`.

---

### RF-203 · Cancelación de incidente

**Descripción:** El administrador puede cancelar un incidente en cualquier estado no terminal, registrando un motivo opcional. La cancelación es irreversible.

**Reglas de negocio:**
- Solo el rol con permiso `incidents:cancel` puede ejecutar esta acción.
- Un incidente ya CERRADO no puede cancelarse (error: _"No se puede cancelar una incidencia cerrada"_).
- Un incidente ya CANCELADA no puede cancelarse de nuevo (error: _"La incidencia ya está cancelada"_).
- Al cancelar: se setea `statusId = CANCELADA`, `cancelledAt = now()`, `cancellationReason = reason?.trim() || null`, y también `resolvedAt = now()` (timestamp de cierre terminal).
- Una vez cancelado, todas las mutaciones de asignaciones hijas quedan bloqueadas (los assignment actions verifican `INCIDENT_TERMINAL_STATES`).
- `syncIncidentState` hace short-circuit si el incidente está en CANCELADA, por lo que ninguna acción posterior en asignaciones puede desbloquear el estado.
- La operación se ejecuta en una transacción para garantizar atomicidad.

**Escenario crítico:** Bloqueo de mutaciones en asignaciones post-cancelación
- DADO un incidente en CANCELADA con una asignación en estado ASIGNADO.
- CUANDO un FSR intenta actualizar el estado de esa asignación.
- ENTONCES la acción de asignación verifica `INCIDENT_TERMINAL_STATES` y rechaza la mutación.

---

### RF-204 · Eliminación de incidente (soft delete)

**Descripción:** El administrador puede desactivar un incidente si no tiene asignaciones activas.

**Reglas de negocio:**
- Se verifica dentro de una transacción: `Assignment.count({ where: { incidentId, active: true } })`.
- Si hay al menos una asignación activa, la operación falla: _"No se puede eliminar el incidente. Tiene N asignación(es) activa(s)."_
- Usa transacción Prisma para evitar condiciones de carrera entre la verificación y el borrado.
- Permiso requerido: `incidents:delete`.
- Acceso al Cliente del incidente verificado vía `assertClienteAccess` antes de proceder.

---

### RF-205 · Actualización de incidente

**Descripción:** El administrador puede editar los campos escalares del incidente (título, descripción, tipo, Cliente, programación, fecha de inicio) y la lista de FSRs habilitados (IncidentAssignee).

**Reglas de negocio:**
- El campo `statusId` y `resolvedAt` son ignorados aunque el caller los envíe. Solo la máquina de estados los modifica.
- Si `assigneeIds` está en el payload, se ejecuta `syncIncidentAssignees` con validación de FSRs activos en asignaciones.
- Si `assigneeIds` es `undefined`, no se toca la lista de FSRs habilitados.
- `assertClienteAccess(user, existing.clienteId)` se verifica antes de la mutación.
- Permiso requerido: `incidents:update`.

---

### RF-206 · Carga masiva de incidentes (bulk import)

**Descripción:** El administrador puede cargar hasta 500 incidentes en lote desde un archivo Excel con dos modos: `template` (encabezados en español con códigos de Cliente) y `snapshot` (IDs directos en inglés).

**Reglas de negocio:**
- Límite máximo: 500 filas por carga (`MAX_BULK_ROWS = 500`).
- **Modo template:** tolerante — errores por campo no descartan la fila; el usuario puede corregirlos en el preview inline antes de guardar.
  - Campos: `titulo`, `descripcion`, `tipo`, `fecha_inicio`, `cliente` (código).
  - Filas completamente vacías se ignoran automáticamente.
  - Tipo vacío es válido (fallback a "Desconocido"); tipo no vacío que no existe en catálogo genera error de campo en el preview.
  - Fechas se parsean con `parseMxDateTime` (formato mexicano).
  - La búsqueda de Cliente por código y de tipo por nombre es insensible a tildes y mayúsculas (`normalizeForMatch`).
- **Modo snapshot:** estricto — cualquier error en cualquier fila aborta todo el preview; usa IDs directos.
  - `clienteId` obligatorio y debe existir y ser accesible al usuario.
  - `resolvedAt` no puede ser anterior a `startedAt`.
- Las filas con `resolvedAt` poblado se crean directamente en estado CERRADO (importación histórica). Las demás se crean en ABIERTO.
- Todo el proceso de persistencia es transaccional: si alguna fila falla la re-validación al guardar, ninguna se crea.
- El `scheduleId` se valida contra la programación: el Cliente de cada fila debe estar incluido en los Clientes de la programación seleccionada.
- La acción `resolveBulkIncidentRows` solo valida/resuelve (no escribe). La acción `createIncidentsFromPreview` persiste.
- Ruta de acceso: `/admin/incidents/bulk`.
- Permiso requerido: `incidents:create`.

---

### RF-207 · Asignación masiva en lote (bulk assign)

**Descripción:** El administrador puede modificar múltiples incidentes en una sola operación, cambiando su programación, Cliente o FSRs habilitados.

**Reglas de negocio:**
- Los campos son opcionales; si ninguno se provee, la operación retorna error.
- La modificación de FSRs soporta dos modos: `replace` (reemplaza la lista) y `append` (agrega a la existente).
- La verificación de acceso al Cliente se evalúa por incidente (actual y destino).
- Si la programación nueva se especifica, el Cliente efectivo de cada incidente (ya sea el nuevo o el actual) debe estar incluido en los Clientes de esa programación.
- La modificación de campos escalares (scheduleId, clienteId) se ejecuta en una sola transacción (`updateMany`). Los FSRs se procesan fuera de la transacción por compatibilidad con `syncIncidentAssignees`.
- Si algún incidente falla la actualización de FSRs (ej. FSR con asignación activa), se retorna `ok: false` con los errores por incidente; los ya procesados no se revierten.
- Permiso requerido: `incidents:update`.

---

### RF-208 · Refresh manual del estado del incidente

**Descripción:** El administrador puede forzar la recalculación del estado del incidente sin modificar ningún dato, para corregir posibles inconsistencias.

**Reglas de negocio:**
- Invoca `syncIncidentState(id)` directamente.
- Retorna el estado anterior y el estado resultante para auditoría.
- Permiso requerido: `incidents:update`.

---

### RF-209 · Cierre forzado de incidente

**Descripción:** El administrador puede forzar el cierre de un incidente si y solo si todas sus asignaciones ya están cerradas.

**Reglas de negocio:**
- Llama a `syncIncidentState(id)`. Si el estado resultante no es CERRADO (hay asignaciones abiertas), lanza error.
- No modifica asignaciones; solo verifica y refleja el estado ya derivado.
- Permiso requerido: `incidents:close`.

---

### RF-210 · Edición rápida de fecha programada del incidente

**Descripción:** Desde la pantalla de "Asignación de Programación", el administrador puede editar la fecha de la programación vinculada al incidente sin abrir el formulario completo.

**Reglas de negocio:**
- Si el incidente ya tiene `scheduleId`, actualiza el campo `scheduledAt` de ese `Schedule`.
- Si no tiene schedule, crea uno nuevo con `title` y `description` del incidente, lo vincula al incidente (`scheduleId`).
- **Efecto secundario importante:** si varios incidentes comparten el mismo `Schedule`, cambiar la fecha desde uno afecta a todos (el código documenta esta advertencia explícitamente).
- Permiso requerido: `incidents:update`.

---

### RF-211 · Edición rápida del tipo de incidente

**Descripción:** Desde la pantalla de "Asignación de Programación", el administrador puede cambiar el tipo del incidente sin abrir el formulario completo.

**Reglas de negocio:**
- El tipo seleccionado debe existir y estar activo en el catálogo.
- Permiso requerido: `incidents:update`.

---

### RF-212 · Filtrado y scoping por Cliente

**Descripción:** Todas las consultas de incidentes aplican automáticamente el filtro de Cliente según el rol del usuario.

**Reglas de negocio:**
- ADMINISTRADOR: ve todos los incidentes, sin filtro de Cliente.
- FSR: `getMyIncidents` retorna solo incidentes donde el FSR tiene al menos una asignación activa como `AssignmentAssignee`.
- CLIENT: `getClientIncidents` retorna solo incidentes que el propio usuario reportó (`reportedById = user.id`) dentro de su Cliente primario.
- En el API REST (`GET /api/incidents`), se puede filtrar opcionalmente por `clienteId` como query param, pero no aplica el scoping por usuario automáticamente (solo verifica permiso `incidents:read`).

---

### RF-213 · Catálogos de incidentes (tipos y estados)

**Descripción:** El sistema mantiene catálogos de `IncidentType` e `IncidentStatus` administrables vía CRUD en la sección de configuración.

**Reglas de negocio:**
- El tipo "Desconocido" está protegido contra eliminación (blindado en `deleteIncidentType` por nombre, según `FALLBACK_INCIDENT_TYPE_NAME`).
- Los estados del catálogo (`IncidentStatus`) deben coincidir con los valores de `INCIDENT_STATE` en el código; si falta alguno, la máquina de estados lanza error al intentar una transición.
- Los estados y tipos inactivos no aparecen en formularios de creación/edición.
- `IncidentType.priority` es obligatorio al crear/editar un tipo. Rango [1, 10]; valores fuera del rango son rechazados por validación Zod (`incidentTypeSchema`). El campo tiene `@default(5)` como red de seguridad a nivel DB.
- El admin puede ver la prioridad de cada tipo en la tabla de catálogo (columna "Prioridad" con badge de color).

### RF-214 · Campo priority en IncidentType — migración y seed

**Descripción:** El esquema de BD incluye `IncidentType.priority Int NOT NULL @default(5)`. La migración aplica `DEFAULT 5` a filas existentes. El seed asigna valores reales a todos los tipos.

**Implementación:** `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`

### RF-215 · Constante CRITICAL_PRIORITY_THRESHOLD

**Descripción:** El sistema define `CRITICAL_PRIORITY_THRESHOLD = 8` en `src/lib/constants/incident-type.ts`. Un incidente es crítico si y solo si `type.priority >= 8`. También define `MIN_INCIDENT_PRIORITY = 1`, `MAX_INCIDENT_PRIORITY = 10`, e `isCriticalPriority(p)`.

### RF-216 · PriorityBadge — visibilidad en todas las superficies

**Descripción:** El valor numérico de prioridad (1–10) se muestra como badge (`PriorityBadge`) en:

| Superficie                        | Archivo                                                                   |
|-----------------------------------|---------------------------------------------------------------------------|
| Tabla de catálogo de tipos        | `src/components/incident-types/incident-type-table.tsx`                  |
| Lista de incidentes (admin)       | `src/components/admin/incidents/incidents-table.tsx`                     |
| Lista de incidentes (FSR)         | `src/app/fsr/incidents/page.tsx`                                         |
| Lista de incidentes (CLIENT)      | `src/app/client/page.tsx`                                                |
| Vista de tracking                 | `src/components/tracking/tracking-table.tsx`                             |
| Reporte distribución por tipo     | `src/app/admin/reports/incidents/incidents-report-client.tsx`            |

**Componente:** `src/components/incident-types/priority-badge.tsx`. Color: 8–10 destructivo (crítico), 5–7 ámbar (medio), 1–4 muted (bajo).

---

## Reglas transversales aplicables

- **El estado del incidente es derivado, no manual:** ninguna acción debe escribir directamente `statusId` excepto la máquina de estados (`syncIncidentState`) y la cancelación (`cancelIncident`). El `updateIncident` ignora explícitamente cualquier `statusId` que el caller provea.
- **CANCELADA es terminal e irreversible:** una vez cancelado, el incidente no puede cerrarse, reabrirse ni modificar sus asignaciones.
- **`typeId NOT NULL`:** la BD requiere tipo en todo incidente. La función `resolveTypeIdOrFallback` garantiza siempre un valor válido.
- **Acceso escoped por Cliente:** `assertClienteAccess(user, clienteId)` se llama antes de toda mutación individual para garantizar que el usuario solo modifica datos de sus Clientes accesibles.
- **Soft delete global:** incidentes y `IncidentAssignee` usan `active: false`; ningún registro se elimina físicamente.
- **Transaccionalidad en validaciones de borrado:** la verificación de hijos activos y la desactivación del padre se hacen dentro de una transacción Prisma para evitar condiciones de carrera.
- **`resolvedAt` automático:** no debe setearse manualmente en edición; es responsabilidad exclusiva de `syncIncidentState` (al pasar a CERRADO) y `cancelIncident` (al cancelar).
