# Delta for Assignments

> Change: `holidays-and-vacations`
> Modifies domain: **04 · Asignaciones** (RF-250–RF-259)

## ADDED Requirements

### Requirement: RF-708 · scheduledDate field on Assignment

The `Assignment` model MUST gain a nullable field `scheduledDate DateTime?` representing the
intended date of field work. Existing rows default to `null`.

The field is set by the ADMIN when creating or updating an assignment. It is not derived from
the state machine. The field is optional; assignments without a `scheduledDate` are valid and
the availability check is skipped at create/update time (see RF-704).

#### Scenario: Assignment created without scheduledDate

- GIVEN an ADMIN creates an assignment without providing `scheduledDate`
- WHEN the assignment is persisted
- THEN `scheduledDate` is `null` and no availability check is performed

#### Scenario: Assignment created with scheduledDate on a non-blocking date

- GIVEN an ADMIN provides `scheduledDate: 2026-10-01` and adds FSR "Fausto"
- AND 2026-10-01 is not a holiday and Fausto has no approved vacation that day
- WHEN the assignment is persisted
- THEN `scheduledDate` is stored and FSR Fausto is assigned normally

---

## MODIFIED Requirements

### Requirement: RF-256 · FSR múltiples por asignación (M-N)

Una asignación puede tener cero o más FSR asignados simultáneamente. La relación se gestiona a
través de `AssignmentAssignee`.

(Previously: no availability check existed when adding FSRs)

**Reglas de negocio:**
- Todos los FSR deben tener rol `FSR` activo al momento de la asignación.
- La actualización de FSR opera con lógica diferencial: calcula quién se agrega (`toAdd`) y
  quién se remueve (`toRemove`).
- La remoción es soft delete en `AssignmentAssignee` (`active: false`); el registro histórico
  se preserva.
- Un FSR que fue removido y se reagrega recibe un nuevo `assignedAt` (upsert con `update`).
- Al agregar FSR nuevos, se envía notificación a cada uno.
- Cualquier cambio en la lista de FSR (**reasignación**) resetea `seenAt` y `seenById` a `null`.
- **NEW** Si la asignación tiene `scheduledDate` no nulo, el sistema MUST verificar
  `isFsrUnavailable` para cada FSR en `toAdd`. Si alguno está inhábil, la operación completa
  MUST ser rechazada con error en español neutro; ningún cambio se persiste. Ver RF-704.

#### Scenario: Creación con FSR sin scheduledDate

- GIVEN que un administrador crea una asignación sin `scheduledDate`
- WHEN selecciona FSR(s) a asignar
- THEN los FSR son asignados sin verificar disponibilidad

#### Scenario: Creación con FSR — FSR bloqueado por inhabilidad

- GIVEN que la asignación tiene `scheduledDate` en un día festivo para el FSR "Gael"
- WHEN el administrador intenta agregar a "Gael" como asignado
- THEN la operación lanza error en español y no se persiste ningún cambio

#### Scenario: Creación con FSR disponible

- GIVEN que la asignación tiene `scheduledDate` en un día laborable para el FSR "Gael"
- WHEN el administrador agrega a "Gael"
- THEN el FSR es asignado correctamente

#### Scenario: Remoción de FSR — no verifica disponibilidad

- GIVEN una asignación con `scheduledDate` y FSR "Gael" ya asignado
- WHEN el administrador remueve a "Gael" (solo `toRemove`, sin `toAdd`)
- THEN la remoción procede sin verificar disponibilidad (soft delete en AssignmentAssignee)

#### Scenario: Reasignación resetea acuse

- GIVEN una asignación en estado ASIGNADO con `seenAt` registrado
- WHEN se modifica la lista de FSR (agrega o remueve alguno)
- THEN `seenAt` y `seenById` se anulan

---

### Requirement: RF-258 · Actividades de trabajo

El FSR registra las actividades ejecutadas durante la asignación. Cada actividad tiene
descripción libre y timestamp.

(Previously: no availability check existed on performedAt)

**Reglas de negocio:**
- Requiere permiso `assignments:update` para crear/actualizar; `assignments:delete` para eliminar.
- No se puede crear/modificar/eliminar si la incidencia padre está en `CERRADO` o `CANCELADA`.
- Eliminación es soft delete.
- Una actividad puede tener partes asociadas (`WorkPart`).
- `performedAt` tiene como valor por defecto `now()` si no se provee.
- **NEW** Al crear una actividad, el sistema MUST verificar `isFsrUnavailable` para el FSR
  autor/asignado en el día CDMX de `performedAt`. Si el FSR está inhábil, la creación MUST
  ser rechazada con error en español neutro; la actividad no se persiste. Ver RF-705.

#### Scenario: Creación de actividad — FSR disponible

- GIVEN la asignación está activa y el FSR no tiene inhabilidad en `performedAt`
- WHEN el FSR crea la actividad
- THEN la actividad se persiste correctamente

#### Scenario: Creación de actividad — FSR bloqueado

- GIVEN el FSR tiene una vacación APROBADA que cubre el día CDMX de `performedAt`
- WHEN el FSR intenta crear la actividad
- THEN el sistema lanza error en español y la actividad no se persiste

#### Scenario: Actividad en día festivo bloqueada

- GIVEN `performedAt` cae en un día festivo activo
- WHEN el FSR intenta registrar la actividad
- THEN el sistema lanza error en español y la actividad no se persiste

#### Scenario: Eliminación de actividad no verifica disponibilidad

- GIVEN una actividad existente
- WHEN el FSR o admin la elimina (soft delete)
- THEN la eliminación procede sin verificar disponibilidad del FSR en `performedAt`
