# 10 · Festivos y vacaciones

> OpusTrack — especificación de dominio. Índice: [spec/README.md](./README.md)

## Propósito

Este dominio modela los **días inhábiles** del sistema como entidades de primera clase y los
usa para **bloquear de forma dura** la operación sobre un FSR en fechas en las que no está
disponible. Cubre dos conceptos:

- **Festivo** (`Holiday`): día no laborable oficial (LFT Art. 74), definido por una regla de
  calendario (fecha fija, n-ésimo lunes, o evento sexenal de ocurrencia única).
- **Vacación** (`Vacation`): periodo de ausencia de un FSR (vacaciones, incapacidad, permiso),
  definido como rango de fechas inclusivo y sujeto a aprobación.

El núcleo del dominio es el helper `isFsrUnavailable(userId, date)`: una función de servidor que
responde si un FSR está inhábil en un día calendario de CDMX, ya sea por festivo o por vacación
aprobada. Las acciones de asignación y de registro de actividad consultan ese helper antes de
persistir.

Toda comparación de fechas se hace en zona **America/Mexico_City** usando los utilitarios
`mxDayRange` / `mxDateString` de `src/lib/utils/datetime.ts` (regla transversal de zona horaria,
ver [00](./00-overview.md)).

---

## Modelo de datos

### Holiday

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `Int` (autoincrement) | PK |
| `name` | `String` | Nombre del festivo (p. ej. "Año Nuevo") |
| `month` | `Int` | Mes del festivo (1=ene … 12=dic). **Siempre requerido.** |
| `day` | `Int?` | Día del mes para festivos de **fecha fija**. Null en reglas de n-ésimo lunes. |
| `nthMonday` | `Int?` | Cuál lunes del mes (1=primero, 3=tercero). Null en reglas de fecha fija. |
| `isRecurring` | `Boolean` (default `true`) | `true` para festivos anuales; `false` para eventos de ocurrencia única. |
| `year` | `Int?` | Año específico para eventos de ocurrencia única (sexenal). Null en reglas recurrentes. |
| `active` | `Boolean` | Soft delete |

Restricción de regla (XOR): **exactamente uno** de `day` o `nthMonday` debe estar presente. Si
`isRecurring` es `false`, `year` es obligatorio. Validado por `HolidayCreateSchema` (Zod) y por
`validateHolidayXOR` en la capa de Server Action.

### VacationStatus (catálogo)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `Int` (autoincrement) | PK |
| `name` | `String` | `PENDIENTE` \| `APROBADA` \| `RECHAZADA` |
| `color` | `String` | Color del badge |
| `active` | `Boolean` | Soft delete |

Sigue el patrón de `ScheduleStatus`. Gestionado solo por ADMINISTRADOR.

### Vacation

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `userId` | `String` | FK → User (el FSR ausente) |
| `startDate` | `DateTime` | Inicio del rango (inclusivo, granularidad de día) |
| `endDate` | `DateTime` | Fin del rango (inclusivo, `endDate >= startDate`) |
| `reason` | `String?` | Motivo opcional (máx. 1000 caracteres) |
| `statusId` | `Int` | FK → VacationStatus |
| `approvedById` | `String?` | Admin que aprobó o rechazó |
| `approvedAt` | `DateTime?` | Momento de la aprobación/rechazo |
| `active` | `Boolean` | Soft delete |

### Assignment (delta)

El dominio agrega a `Assignment` el campo `scheduledDate DateTime?` (nullable; las filas
existentes quedan en null). Es la fecha contra la que se evalúa la disponibilidad del FSR al
crear o actualizar una asignación (ver RF-704).

---

## Requisitos

### RF-700 · Catálogo de festivos (CRUD de admin)

El sistema mantiene un catálogo de días no laborables oficiales (LFT Art. 74). Un ADMINISTRADOR
puede crear, actualizar y dar de baja (soft delete) festivos. Las reglas soportadas son:

- **Fecha fija**: `month` + `day`; se repite cada año cuando `isRecurring: true`.
- **N-ésimo lunes**: `month` + `nthMonday` (1=primero, 3=tercero); se resuelve en tiempo de
  consulta para el año de la fecha evaluada.
- **Sexenal de ocurrencia única**: `isRecurring: false` + `year` (p. ej. Transmisión del Poder
  Ejecutivo).

El seed crea los 8 festivos de la LFT Art. 74:

| Nombre | Regla |
|---|---|
| Año Nuevo | fija 1-ene |
| Día de la Constitución | 1.er lunes de feb |
| Natalicio de Benito Juárez | 3.er lunes de mar |
| Día del Trabajo | fija 1-may |
| Día de la Independencia | fija 16-sep |
| Día de la Revolución | 3.er lunes de nov |
| Navidad | fija 25-dic |
| Transmisión del Poder Ejecutivo | única 1-oct (año sexenal, `isRecurring: false`) |

La evaluación de si una regla aplica a una fecha la realiza `holidayRuleMatchesDate(rule,
dateStr)`: el mes siempre debe coincidir; en reglas de fecha fija coincide el día del mes; en
reglas de n-ésimo lunes el día debe ser lunes y `floor((día-1)/7)+1` debe igualar `nthMonday`;
en reglas de ocurrencia única el año de la fecha debe igualar `year`. Una regla malformada (sin
`day` ni `nthMonday`) nunca coincide.

#### Escenario: Crear festivo de fecha fija

- DADO un ADMINISTRADOR autenticado con permiso `holidays:create`
- CUANDO envía un festivo con `month: 1`, `day: 1`, `isRecurring: true`
- ENTONCES se persiste con `active: true` y aparece en el catálogo

#### Escenario: Crear festivo de n-ésimo lunes

- DADO un ADMINISTRADOR autenticado con permiso `holidays:create`
- CUANDO envía `month: 2`, `nthMonday: 1`, `isRecurring: true`
- ENTONCES se persiste y `isFsrUnavailable` lo resuelve como el primer lunes de febrero para
  cualquier año consultado

#### Escenario: Rechazo de regla ambigua (XOR)

- DADO un ADMINISTRADOR creando un festivo
- CUANDO envía a la vez `day` y `nthMonday`, o no envía ninguno de los dos
- ENTONCES la validación rechaza la operación con un error en español

#### Escenario: Festivo de ocurrencia única requiere año

- DADO un ADMINISTRADOR creando un festivo con `isRecurring: false`
- CUANDO no especifica `year`
- ENTONCES la validación rechaza la operación

#### Escenario: Soft delete de festivo

- DADO un festivo activo en el catálogo
- CUANDO el ADMINISTRADOR lo elimina
- ENTONCES `active` pasa a `false` y el festivo se excluye de los chequeos de disponibilidad

#### Escenario: Un no-admin no puede gestionar festivos

- DADO un FSR autenticado
- CUANDO intenta crear, actualizar o eliminar un festivo
- ENTONCES la acción se rechaza por falta de permiso

---

### RF-701 · Solicitud de vacación (el FSR crea la propia; el ADMIN crea para cualquier FSR)

El sistema permite a un FSR registrar solicitudes de ausencia para sí mismo. Un ADMINISTRADOR
puede crear vacaciones a nombre de cualquier FSR (incapacidades o permisos aprobados).

Una vacación se define como un rango de fechas inclusivo (`startDate`–`endDate`) con granularidad
de día (sin componente horario). `endDate` debe ser igual o posterior a `startDate` (validado por
`VacationCreateSchema` y `validateVacationDates`).

Al crear, el sistema rechaza una vacación nueva si el mismo FSR ya tiene una vacación PENDIENTE o
APROBADA cuyo rango se solapa con el nuevo (`startDate <= existente.endDate AND endDate >=
existente.startDate`). Rangos adyacentes (que no se solapan) sí se permiten.

#### Escenario: El FSR crea su propia vacación

- DADO un FSR autenticado con permiso `vacations:create`
- CUANDO envía `startDate: 2026-07-01`, `endDate: 2026-07-05`, `reason: "Verano"`
- ENTONCES se crea una vacación con `statusId` = PENDIENTE y `userId` = el del solicitante

#### Escenario: El ADMIN crea vacación para otro FSR

- DADO un ADMINISTRADOR autenticado con permiso `vacations:create`
- CUANDO envía una vacación con `userId` = cualquier FSR
- ENTONCES se crea con `statusId` = PENDIENTE y el `userId` indicado

#### Escenario: El FSR no puede crear vacación para otro usuario

- DADO un FSR autenticado
- CUANDO intenta enviar una vacación con `userId` distinto del propio
- ENTONCES la acción se rechaza

#### Escenario: Rechazo por solape

- DADO que el FSR "Alicia" tiene una vacación (PENDIENTE o APROBADA) del 2026-07-01 al 2026-07-10
- CUANDO Alicia (o un ADMIN) crea una vacación nueva del 2026-07-08 al 2026-07-15
- ENTONCES el sistema rechaza con un error claro en español y no persiste registro

---

### RF-702 · Aprobación de vacación (el ADMIN aprueba o rechaza)

Un ADMINISTRADOR puede transicionar una vacación de PENDIENTE a APROBADA o RECHAZADA. El sistema
registra `approvedById` y `approvedAt`.

Aprobar una vacación que se solapa con asignaciones existentes del FSR **debe tener éxito sin
modificar ni reasignar** esas asignaciones (no hay reasignación automática).

#### Escenario: El ADMIN aprueba una vacación pendiente

- DADO una vacación en estado PENDIENTE
- CUANDO el ADMIN la aprueba
- ENTONCES `statusId` = APROBADA, `approvedById` = id del admin, `approvedAt` = ahora

#### Escenario: El ADMIN rechaza una vacación pendiente

- DADO una vacación en estado PENDIENTE
- CUANDO el ADMIN la rechaza
- ENTONCES `statusId` = RECHAZADA, con `approvedById` y `approvedAt` registrados

#### Escenario: Aprobar vacación solapada con asignaciones — sin reasignación

- DADO que el FSR "Beto" tiene asignaciones con `scheduledDate` dentro del rango
- CUANDO el ADMIN aprueba la vacación de Beto
- ENTONCES la vacación pasa a APROBADA Y las asignaciones de Beto quedan intactas (sin
  modificación ni error)

#### Escenario: Un no-admin no puede aprobar ni rechazar

- DADO un FSR autenticado
- CUANDO intenta aprobar o rechazar cualquier vacación
- ENTONCES la acción se rechaza por falta de permiso

---

### RF-703 · Helper de disponibilidad del FSR (`isFsrUnavailable`)

El sistema expone una función de servidor `isFsrUnavailable(userId, date): Promise<boolean>` que
devuelve `true` cuando la fecha dada (evaluada como día calendario de CDMX) coincide con alguno
de los siguientes:

1. Un `Holiday` activo (regla de fecha fija, n-ésimo lunes, o sexenal por `year`).
2. Una `Vacation` activa con `statusId` = **APROBADA** donde `startDate <= date <= endDate` para
   ese `userId`.

**Solo las vacaciones APROBADAS bloquean.** Las PENDIENTE o RECHAZADA no afectan la
disponibilidad. El helper evalúa primero los festivos (consulta acotada por mes, ~8 reglas) y
hace short-circuit antes de consultar vacaciones.

Toda conversión de un instante UTC al día calendario de CDMX se hace antes de comparar contra los
campos de fecha de la base, evitando errores de off-by-one por zona horaria.

Variante en lote: `unavailableFsrsForDate(userIds, date)` devuelve el subconjunto de FSRs
inhábiles en la fecha (chequeos individuales en paralelo).

#### Escenario: Devuelve true para festivo de fecha fija

- DADO que el 1 de enero está sembrado como festivo de fecha fija
- CUANDO se llama `isFsrUnavailable(cualquierUserId, instante del 2027-01-01 en CDMX)`
- ENTONCES devuelve `true`

#### Escenario: Devuelve true para vacación aprobada

- DADO que el FSR "Carlos" tiene una vacación APROBADA del 2026-09-01 al 2026-09-05
- CUANDO se llama `isFsrUnavailable("carlos-id", instante del 2026-09-03)`
- ENTONCES devuelve `true`

#### Escenario: Devuelve false para vacación pendiente

- DADO que el FSR "Carlos" tiene una vacación PENDIENTE (no aprobada) del 2026-09-01 al 2026-09-05
- CUANDO se llama `isFsrUnavailable("carlos-id", instante del 2026-09-03)`
- ENTONCES devuelve `false` (solo las aprobadas bloquean)

#### Escenario: Guarda contra off-by-one de zona horaria

- DADO un instante `2026-12-26T01:00:00Z`, que en CDMX corresponde al `2026-12-25` (Navidad, festivo)
- CUANDO se llama `isFsrUnavailable(cualquierUserId, ese instante)`
- ENTONCES el sistema evalúa el día CDMX (25-dic) y devuelve `true` (sin off-by-one)

---

### RF-704 · Bloqueo duro en creación/actualización de asignación (`scheduledDate`)

Cuando `createAssignment` o `updateAssignment` agregan uno o más FSR (lista `toAdd`) y la
asignación tiene `scheduledDate` no nulo, el sistema llama `isFsrUnavailable` para cada FSR de
`toAdd`. Si alguno está inhábil en esa fecha, **toda la operación se rechaza** con un error claro
en español neutro y no se persiste ningún cambio.

Si `scheduledDate` es `null` o ausente, el sistema **no** ejecuta el chequeo al crear/actualizar
(la verificación se difiere al registro de actividad, ver RF-705).

#### Escenario: Bloqueo — FSR inhábil en `scheduledDate`

- DADO una asignación con `scheduledDate: 2026-12-25` (Navidad)
- Y `toAdd` contiene al FSR "Diana"
- CUANDO se llama `createAssignment` o `updateAssignment`
- ENTONCES el sistema lanza un error en español y no persiste asignación ni registro de asignado

#### Escenario: Permitido — `scheduledDate` es null

- DADO una asignación con `scheduledDate: null`
- Y `toAdd` contiene al FSR "Diana" (que tiene una vacación en alguna fecha)
- CUANDO se llama `createAssignment` o `updateAssignment`
- ENTONCES la operación procede sin chequear disponibilidad; Diana se agrega normalmente

#### Escenario: Permitido — FSR disponible en `scheduledDate`

- DADO una asignación con `scheduledDate: 2026-12-26` (no festivo, sin vacación aprobada del FSR)
- Y `toAdd` contiene al FSR "Diana"
- CUANDO se llama la operación
- ENTONCES el FSR se agrega y la asignación se persiste normalmente

---

### RF-705 · Bloqueo duro en registro de actividad (`performedAt`)

Cuando se llama `createAssignmentActivity`, el sistema llama `isFsrUnavailable` para el FSR
autor/asignado sobre la fecha `performedAt`. Si el FSR está inhábil, la operación **se rechaza**
con un error claro en español neutro y la actividad no se persiste.

#### Escenario: Bloqueo — FSR inhábil en `performedAt`

- DADO que el FSR "Elena" tiene una vacación APROBADA que cubre el 2026-09-15
- CUANDO se llama `createAssignmentActivity` con `performedAt` del 2026-09-15 (día CDMX)
- ENTONCES el sistema lanza un error en español y la actividad no se crea

#### Escenario: Permitido — FSR disponible en `performedAt`

- DADO que el FSR "Elena" no tiene vacación aprobada ni festivo el 2026-09-16
- CUANDO se llama `createAssignmentActivity` con `performedAt` del 2026-09-16
- ENTONCES la actividad se crea normalmente

---

### RF-706 · RBAC — permisos y rutas de festivos y vacaciones

El sistema siembra los siguientes permisos y los asigna a los roles:

| Permiso | ADMINISTRADOR | FSR | CLIENT | GUEST |
|---|:---:|:---:|:---:|:---:|
| `holidays:read` | ✓ | — | — | — |
| `holidays:create` | ✓ | — | — | — |
| `holidays:update` | ✓ | — | — | — |
| `holidays:delete` | ✓ | — | — | — |
| `vacations:read` | ✓ | ✓ | — | — |
| `vacations:create` | ✓ | ✓ | — | — |
| `vacations:approve` | ✓ | — | — | — |
| `vacations:delete` | ✓ | ✓ | — | — |

Rutas (el acceso se resuelve por prefijo; ADMINISTRADOR pasa todos los checks, ver [01](./01-auth-rbac.md)):

| Prefijo de ruta | Roles permitidos |
|---|---|
| `/admin/holidays` | ADMINISTRADOR |
| `/admin/vacations` | ADMINISTRADOR |
| `/fsr/vacations` | FSR |

Los FSR solo ven y gestionan sus propias vacaciones (`userId` = el propio). El ADMIN ve todas.

#### Escenario: El FSR accede a su lista de vacaciones

- DADO un FSR autenticado
- CUANDO navega a `/fsr/vacations`
- ENTONCES solo ve registros donde `userId` = su propio id

#### Escenario: El FSR no puede acceder a la lista de admin

- DADO un FSR autenticado
- CUANDO intenta acceder a `/admin/vacations`
- ENTONCES el control de acceso lo redirige a `/unauthorized`

#### Escenario: El ADMIN ve todas las vacaciones

- DADO un ADMINISTRADOR autenticado
- CUANDO navega a `/admin/vacations`
- ENTONCES ve los registros de vacaciones de todos los FSR

---

### RF-707 · Catálogo VacationStatus

El sistema siembra un catálogo `VacationStatus` (siguiendo el patrón de `ScheduleStatus`, con
`color` y `active`):

| name | color |
|---|---|
| PENDIENTE | Ámbar (`#F59E0B`) |
| APROBADA | Verde (`#10B981`) |
| RECHAZADA | Rojo (`#EF4444`) |

Soft delete: `active: false`. Gestionado solo por ADMINISTRADOR.

---

## No-objetivos (confirmados, fuera de alcance)

- Vacaciones con granularidad sub-día (medio día).
- Reasignación automática de asignaciones existentes al aprobar una vacación.
- Notificaciones de aprobación de vacación (dependen del gap de notificaciones, RF-450+).
- Auto-siembra de día electoral (el ADMIN lo crea manualmente como festivo de ocurrencia única).
- Días de vacación no contiguos (solo modelo de rango).
- Bloqueo en la habilitación de `IncidentAssignee` (no hay fecha de trabajo en esa entidad; la
  verificación vive en `scheduledDate` de la asignación y en `performedAt` de la actividad).

---

## Cobertura de pruebas

La lógica pura de este dominio está cubierta por pruebas unitarias (Vitest):

- `src/lib/utils/availability.test.ts` — `holidayRuleMatchesDate`, `isHoliday`,
  `isFsrUnavailable`, `unavailableFsrsForDate`.
- `src/lib/validations/holidays.test.ts` — `HolidayCreateSchema`, `validateHolidayXOR`.
- `src/lib/validations/vacations.test.ts` — `VacationCreateSchema`, `validateVacationDates`.

---

## RF rango registrado

RF-700 – RF-749: Festivos y vacaciones (este dominio).
