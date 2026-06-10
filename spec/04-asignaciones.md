# 04 · Asignaciones

> OpusTrack — especificación de dominio. Índice: spec/README.md

## Propósito

Una **asignación** (assignment) es la orden de trabajo que uno o más FSR ejecutan para resolver un incidente. Representa el ciclo completo de atención en campo: desde que el administrador asigna hasta que el FSR cierra con evidencia y coordenadas GPS. El estado de la asignación impulsa automáticamente el estado del incidente padre mediante `syncIncidentState`.

---

## Modelo de datos

### Assignment

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `String` (cuid) | Identificador interno del sistema |
| `folio` | `Int` (autoincrement, unique) | Folio numérico autoincremental único, generado por la base de datos; nunca se puede modificar |
| `odtFolio` | `String?` | **RF-010** — Folio ODT capturado del sistema externo (Verificentro). Requerido para cerrar la asignación |
| `incidentId` | `Int` | Referencia al incidente padre |
| `statusId` | `Int?` | Referencia a `AssignmentStatus` (estado de la máquina de estados) |
| `notes` | `String?` | Notas opcionales |
| `assignedAt` | `DateTime?` | Momento en que se asignó (o reasignó) al primer FSR; base del cálculo time-to-seen |
| `seenAt` | `DateTime?` | Timestamp del primer acuse del FSR (transición ASIGNADO → VISTO) |
| `seenById` | `String?` | FSR que ejecutó el primer acuse |
| `startedAt` | `DateTime?` | Timestamp de inicio en sitio (transición → INICIADO) |
| `startLatitude` | `Float?` | GPS latitud capturada al iniciar en sitio |
| `startLongitude` | `Float?` | GPS longitud capturada al iniciar en sitio |
| `startAddress` | `String?` | Dirección opcional capturada al iniciar en sitio |
| `finishedAt` | `DateTime?` | Timestamp de cierre (transición → CERRADO); se anula si la asignación se reabre |
| `endLatitude` | `Float?` | GPS latitud capturada al cerrar |
| `endLongitude` | `Float?` | GPS longitud capturada al cerrar |
| `endAddress` | `String?` | Dirección opcional capturada al cerrar |
| `active` | `Boolean` | Soft delete |

### AssignmentAssignee (tabla M-N)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `assignmentId` | `String` | FK → Assignment |
| `userId` | `String` | FK → User (debe tener rol FSR) |
| `assignedAt` | `DateTime` | Timestamp de esta asignación individual |
| `active` | `Boolean` | Soft delete (remoción de FSR sin borrar el registro) |

Restricción única: `(assignmentId, userId)`.

### AssignmentActivity

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `assignmentId` | `String` | FK → Assignment |
| `description` | `String` | Texto libre que describe el trabajo realizado |
| `performedAt` | `DateTime` | Momento de ejecución (por defecto `now()`) |
| `workParts` | `WorkPart[]` | Partes usadas en esta actividad específica |
| `active` | `Boolean` | Soft delete |

### AssignmentAttachment

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `assignmentId` | `String` | FK → Assignment |
| `filename` | `String` | Nombre de archivo original |
| `filepath` | `String` | URL/path de almacenamiento |
| `mimetype` | `String` | MIME type del archivo |
| `size` | `Int` | Tamaño en bytes |
| `description` | `String?` | Descripción opcional del adjunto |
| `provider` | `String` | Proveedor de almacenamiento: `"vercel-blob"` o `"filesystem"` |
| `active` | `Boolean` | Soft delete |

---

## Estados y transiciones

### Máquina de estados de la asignación

| Estado | Significado semántico | Color badge |
|---|---|---|
| `PENDIENTE_DE_ASIGNACION` | Creada sin FSR asignado | Slate `#94A3B8` |
| `ASIGNADO` | Tiene al menos un FSR; pendiente de acuse | Purple `#8B5CF6` |
| `VISTO` | FSR ejecutó primer acuse (seenAt capturado) | Cyan `#06B6D4` |
| `INICIADO` | FSR inició trabajo en sitio (GPS start capturado) | Blue `#3B82F6` |
| `EN_PROGRESO` | Trabajo pausado / continúa en campo | Amber `#F59E0B` |
| `CERRADO` | Trabajo finalizado (GPS end + evidencia + odtFolio) | Green `#10B981` |

### Transiciones permitidas

| Desde | Hacia | Acción / Condición |
|---|---|---|
| `PENDIENTE_DE_ASIGNACION` | `ASIGNADO` | Se agrega el primer FSR |
| `ASIGNADO` | `PENDIENTE_DE_ASIGNACION` | Se remueve el último FSR (solo si no ha avanzado más allá de ASIGNADO) |
| `ASIGNADO` | `VISTO` | FSR ejecuta acuse (`markAssignmentSeen`) |
| `VISTO` | `INICIADO` | FSR inicia en sitio con GPS (`startAssignmentWork`) |
| `INICIADO` | `EN_PROGRESO` | FSR pausa el trabajo (`pauseAssignment`) |
| `INICIADO` | `CERRADO` | FSR cierra directamente desde INICIADO |
| `EN_PROGRESO` | `INICIADO` | FSR reanuda trabajo en sitio (`resumeAssignment`) |
| `EN_PROGRESO` | `CERRADO` | FSR cierra desde EN_PROGRESO |
| `CERRADO` | `EN_PROGRESO` | Admin reabre (`reopenAssignment`; requiere permiso `assignments:reopen`) |

**Regla de auto-transición por reasignación**: cuando se modifica la lista de FSR y el estado actual es `PENDIENTE_DE_ASIGNACION` → transiciona automáticamente a `ASIGNADO`. Si se elimina el último FSR y el estado es `ASIGNADO` → revierte a `PENDIENTE_DE_ASIGNACION`. No afecta estados posteriores a `ASIGNADO`.

**Reasignación y reset de acuse**: cuando cambia la lista de FSR (algún FSR es agregado o removido), `seenAt` y `seenById` se anulan. El nuevo FSR debe ejecutar el acuse nuevamente.

---

## Requisitos funcionales

### RF-010 · Captura de folio ODT externo

**Descripción:** El FSR captura el folio ODT emitido por el sistema externo de verificación (Verificentro). Este campo es independiente del `folio` interno autoincremental. Se puede actualizar en cualquier momento mientras la incidencia no esté `CERRADA` o `CANCELADA`.

**Reglas de negocio:**
- `odtFolio` es opcional durante la creación y actualización de la asignación.
- Es **obligatorio** al momento de cerrar la asignación (precondición de `CERRADO`).
- La acción dedicada `updateAssignmentOdtFolio` requiere permiso `assignments:update`.
- No es posible actualizar si la incidencia padre está en estado `CERRADO` o `CANCELADA`.

---

### RF-250 · Ciclo de vida completo de la asignación

**Descripción:** El administrador crea una asignación vinculada a un incidente activo, con cero o más FSR. El estado inicial es determinado automáticamente por la máquina de estados.

**Reglas de negocio:**
- Si se crean sin FSR → estado inicial: `PENDIENTE_DE_ASIGNACION`.
- Si se crean con FSR → estado inicial: `ASIGNADO`; se persiste `assignedAt`.
- El `statusId` provisto por el llamador es ignorado; la máquina de estados es la única que lo asigna.
- Solo usuarios con rol `FSR` y estado activo pueden ser asignados.
- Al crear con FSR, se envía notificación de alta prioridad a cada FSR asignado.
- No se puede eliminar una asignación que tenga partes, actividades o adjuntos activos.
- La eliminación es siempre soft delete (`active: false`).

**Escenario crítico — creación sin FSR:**
- DADO que un administrador crea una asignación sin seleccionar FSR.
- CUANDO se persiste la asignación.
- ENTONCES el estado es `PENDIENTE_DE_ASIGNACION` y `assignedAt` es `null`.

---

### RF-251 · Folio interno autoincremental

**Descripción:** Cada asignación recibe un número de folio único, generado automáticamente por la base de datos (`autoincrement`).

**Reglas de negocio:**
- El `folio` es único a nivel global (constraint `@unique` en la base de datos).
- No es configurable ni editable por ningún actor del sistema.
- Es un identificador de referencia rápida para operadores y reportes; distinto de `id` (cuid) y de `odtFolio`.

---

### RF-252 · Acuse "Visto" (primer acuse del FSR)

**Descripción:** El FSR acusa recibido de su asignación desde el estado `ASIGNADO`. Esta acción transiciona a `VISTO` y registra quién y cuándo realizó el acuse.

**Reglas de negocio:**
- Solo el FSR asignado o un administrador puede ejecutar el acuse.
- Si la asignación ya está en `VISTO` (o estado posterior), la llamada es idempotente (devuelve `noop: true`).
- Los campos `seenAt` y `seenById` se persisten en la misma transacción.
- La acción requiere que la incidencia padre no esté en estado `CERRADO` ni `CANCELADA`.
- La métrica **time-to-seen** se calcula como `seenAt − assignedAt` en minutos. Se usa en el reporte `/admin/reports/seen-time`.

**Escenario crítico — acuse "Visto":**
- DADO que una asignación está en estado `ASIGNADO` y el FSR asignado la visualiza.
- CUANDO el FSR ejecuta `markAssignmentSeen`.
- ENTONCES el estado cambia a `VISTO`, `seenAt` = timestamp actual, `seenById` = id del FSR, y `syncIncidentState` actualiza el incidente padre.

---

### RF-253 · Inicio de trabajo en sitio con GPS

**Descripción:** El FSR registra el inicio de trabajo presencial. La transición a `INICIADO` requiere coordenadas GPS válidas.

**Reglas de negocio:**
- Solo el FSR asignado o un administrador puede ejecutar esta acción.
- Los campos obligatorios son: `latitude` (float finito), `longitude` (float finito). `address` es opcional.
- Se persisten: `startedAt` (timestamp del servidor), `startLatitude`, `startLongitude`, `startAddress`.
- La transición solo es posible desde `VISTO`.
- Las transiciones a `INICIADO` y `CERRADO` no son accesibles desde `updateAssignmentStatus` (acción genérica); deben usar las acciones dedicadas que capturan GPS.

**Escenario crítico — inicio con GPS:**
- DADO que una asignación está en `VISTO` y el FSR está en campo.
- CUANDO el FSR ejecuta `startAssignmentWork` con coordenadas GPS válidas.
- ENTONCES el estado cambia a `INICIADO`, `startedAt` = ahora, `startLatitude`/`startLongitude` se persisten, y `syncIncidentState` actualiza el incidente.

---

### RF-254 · Cierre de asignación con precondiciones

**Descripción:** El FSR cierra la asignación desde `INICIADO` o `EN_PROGRESO`. El cierre requiere GPS final, al menos un adjunto activo y el `odtFolio` capturado.

**Reglas de negocio:**
- Requiere permiso `assignments:complete`.
- Precondiciones evaluadas (ver `assertAssignmentPreconditions`):
  1. `endLatitude` y `endLongitude` no nulos (coordenadas GPS finales).
  2. `finishedAt` no nulo.
  3. Al menos 1 adjunto activo (`AssignmentAttachment.active = true`).
  4. `odtFolio` no nulo ni vacío.
- Se persisten: `finishedAt` (timestamp del servidor), `endLatitude`, `endLongitude`, `endAddress`.
- Faltando cualquiera de las precondiciones, la transacción lanza error descriptivo y no persiste cambios.

**Escenario crítico — cierre con precondiciones:**
- DADO que una asignación está en `INICIADO` con un adjunto activo y `odtFolio` registrado.
- CUANDO el FSR ejecuta `closeAssignment` con coordenadas GPS válidas.
- ENTONCES el estado cambia a `CERRADO`, `finishedAt` se persiste, y `syncIncidentState` evalúa si todos los assignments del incidente están `CERRADO` para cerrar también la incidencia.

- DADO que una asignación está en `INICIADO` sin adjuntos.
- CUANDO el FSR intenta ejecutar `closeAssignment`.
- ENTONCES la transacción lanza `"No se puede cerrar la asignación sin al menos una evidencia"` y el estado no cambia.

---

### RF-255 · Reapertura de asignación cerrada (admin)

**Descripción:** Un administrador puede reabrir una asignación cerrada, retrocediendo de `CERRADO` a `EN_PROGRESO`.

**Reglas de negocio:**
- Requiere permiso `assignments:reopen`.
- Al reabrir, `finishedAt` se anula.
- `syncIncidentState` recalcula el estado del incidente padre.
- Esta es la única transición "hacia atrás" disponible en el sistema.

---

### RF-256 · FSR múltiples por asignación (M-N)

**Descripción:** Una asignación puede tener cero o más FSR asignados simultáneamente. La relación se gestiona a través de `AssignmentAssignee`.

**Reglas de negocio:**
- Todos los FSR deben tener rol `FSR` activo al momento de la asignación.
- La actualización de FSR opera con lógica diferencial: calcula quién se agrega (`toAdd`) y quién se remueve (`toRemove`).
- La remoción es soft delete en `AssignmentAssignee` (`active: false`); el registro histórico se preserva.
- Un FSR que fue removido y se reagrega recibe un nuevo `assignedAt` (upsert con `update`).
- Al agregar FSR nuevos, se envía notificación a cada uno.
- Cualquier cambio en la lista de FSR (**reasignación**) resetea `seenAt` y `seenById` a `null`.

---

### RF-257 · Sincronización de estado incidente desde asignaciones

**Descripción:** El estado del incidente padre se recalcula automáticamente después de cada mutación de estado en cualquiera de sus asignaciones.

**Reglas de negocio:**
- `syncIncidentState` siempre se llama dentro de la misma transacción que el cambio de estado.
- El algoritmo evalúa todos los assignments activos del incidente:
  - Si **todos** están en `CERRADO` → incidente pasa a `CERRADO` (se persiste `resolvedAt`).
  - Si el incidente está en `CANCELADA` → `syncIncidentState` es un no-op (estado terminal protegido).
  - Si hay assignments en estados mixtos → el incidente adopta el estado más avanzado entre los assignments no cerrados.
- El mapeo de estado assignment → estado incidente es 1:1 (PENDIENTE_DE_ASIGNACION → ABIERTO, ASIGNADO → ASIGNADO, etc.).

---

### RF-258 · Actividades de trabajo

**Descripción:** El FSR registra las actividades ejecutadas durante la asignación. Cada actividad tiene descripción libre y timestamp.

**Reglas de negocio:**
- Requiere permiso `assignments:update` para crear/actualizar; `assignments:delete` para eliminar.
- No se puede crear/modificar/eliminar si la incidencia padre está en `CERRADO` o `CANCELADA`.
- Eliminación es soft delete.
- Una actividad puede tener partes asociadas (`WorkPart`).
- `performedAt` tiene como valor por defecto `now()` si no se provee.

---

### RF-259 · Adjuntos y evidencia

**Descripción:** El FSR sube archivos de evidencia (fotos, video, PDF) a la asignación. Al menos uno es requerido para cerrar.

**Reglas de negocio:**
- El upload utiliza `FormData` con el archivo como `File` (sin base64) para evitar inflación de tamaño en Server Actions.
- Límite de tamaño: **10 MB** por archivo.
- Tipos MIME permitidos: imágenes (jpeg, png, gif, webp, bmp, tiff, svg, heic, heif), video (mp4, quicktime, webm, avi, 3gpp, mkv), PDF, Word (.doc/.docx), texto plano.
- Cada registro almacena el `provider` usado (`vercel-blob` o `filesystem`), lo que permite eliminación correcta aunque el proveedor cambie en el futuro.
- La eliminación es soft delete en BD + borrado físico en el proveedor de almacenamiento (fallo del borrado físico se registra en consola pero no falla la operación).
- No se puede subir ni eliminar adjuntos si la incidencia padre está en `CERRADO` o `CANCELADA`.

---

## Reglas transversales aplicables

- **Soft delete universal**: ningún registro se borra físicamente. `active: false` en Assignment, AssignmentAssignee, AssignmentActivity, AssignmentAttachment.
- **Bloqueo por incidencia terminal**: las acciones de escritura (actividades, partes, adjuntos, cambios de estado FSR) están bloqueadas si la incidencia padre está en `CERRADO` o `CANCELADA`.
- **Cache revalidation**: todas las mutaciones revalidan `/admin/assignments`, `/fsr/assignments`, y `/admin/incidents/{id}`.
- **Permisos requeridos**:
  - `assignments:read` — lectura.
  - `assignments:create` — crear asignación.
  - `assignments:update` — actualizar, acuse, adjuntos, actividades.
  - `assignments:delete` — eliminar asignación/actividades.
  - `assignments:complete` — cerrar asignación.
  - `assignments:reopen` — reabrir (solo admin).
- **Filtrado por Cliente**: los usuarios no ADMINISTRADOR solo ven asignaciones cuya incidencia pertenece a su(s) Cliente(s). ADMINISTRADOR ve todo.
