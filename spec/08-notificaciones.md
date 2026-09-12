# 08 · Notificaciones

> OpusTrack — especificación de dominio. Índice: spec/README.md

## Propósito

Informar a los usuarios sobre eventos relevantes del sistema — incidentes,
asignaciones, vacaciones y comunicados — sin que tengan que consultar
activamente la interfaz. Las notificaciones son persistentes (base de datos)
con dos canales de entrega por evento: **in-app** (bandeja universal
`/notifications`) y **correo** (SMTP vía `EmailOutbox` con reintentos). Qué
canal usa cada evento lo decide una matriz global administrable
(`NotificationChannelPolicy`); quién recibe cada evento está fijo en código
(audiencias por capacidad, nunca por nombre de rol). Sin preferencias por
usuario.

Además del flujo automático, los administradores de módulo pueden emitir
**difusiones** (inmediatas o programadas) a roles destinatarios, con alcance
limitado por rol emisor (`RoleBroadcastTarget`).

---

## Modelo de datos

**Tabla:** `Notification` (`prisma/schema.prisma`)

| Campo        | Tipo          | Descripción                                                        |
|--------------|---------------|--------------------------------------------------------------------|
| `id`         | String (cuid) | Identificador único                                                |
| `userId`     | String        | Receptor de la notificación (FK → User)                            |
| `title`      | String        | Título breve (ej.: "Nueva asignación")                             |
| `message`    | String        | Cuerpo del mensaje                                                 |
| `type`       | String        | Tipo de evento (ver catálogo `NOTIFICATION_EVENTS`)                |
| `entityType` | String?       | Tipo de entidad vinculada: `assignment`, `incident`, `user`, `schedule`, `vacation`, `broadcast` |
| `entityId`   | String?       | ID de la entidad vinculada (polimórfico)                           |
| `actionUrl`  | String?       | Ruta de navegación al hacer clic (siempre link neutral `/notifications/go/...` en eventos de incidente y vacación) |
| `isRead`     | Boolean       | Estado de lectura (default: `false`)                               |
| `readAt`     | DateTime?     | Timestamp exacto de cuando se marcó como leída                     |
| `priority`   | Int           | Prioridad numérica: 1=low, 2=medium, 3=high (default: 1)           |
| `metadata`   | Json?         | Datos adicionales flexibles                                        |
| `active`     | Boolean       | Soft delete (default: `true`)                                      |

**Índices definidos:**
- `(userId, isRead)` — conteo rápido de no leídas
- `(userId, createdAt)` — listado de notificaciones recientes
- `(type)` — filtrado por tipo
- `(active, createdAt)` — consultas de limpieza

**Tabla:** `NotificationChannelPolicy` — matriz evento × canal. Clave primaria
`type String` (el tipo de evento); `inApp Boolean`, `email Boolean`. Si ambos
están apagados, el evento está desactivado. Sin columna `active` a propósito:
es configuración con forma de log (como `AuditLog`), nunca se borra. Columnas
de atribución RF-550.

**Tabla:** `EmailOutbox` — un renglón por mensaje de correo: `notificationType`,
`subject`, `text`, `html`, `recipients String[]`, `status` (`PENDIENTE`,
`ENVIADO`, `FALLIDO`), `attempts`, `lastError` (solo clase de error, sin PII),
`nextAttemptAt`, `broadcastId?`. Sin `active`: los reintentos ACTUALIZAN la
fila, nada la borra. Índice `(status, nextAttemptAt)`.

**Tabla:** `Broadcast` — difusión persistida (inmediata o programada): `title`,
`message`, `kind` (`SYSTEM`/`ANNOUNCEMENT`), `sendInApp`, `sendEmail`,
`allRoles`, `includeSender`, `scheduledAt` (UTC), `status` (`PROGRAMADA`,
`ENVIANDO`, `ENVIADA`, `CANCELADA`, `FALLIDA`), `sentAt`, `recipientCount`,
`createdById`, `active`. Las difusiones generan notificaciones con
`entityType: "broadcast"` y `entityId` = ID de la difusión; el tipo de evento
(`system` / `announcement`) solo aporta prioridad y etiqueta.

**Tabla:** `BroadcastRole` — pivote `Broadcast ↔ Role` (audiencia por roles,
selección múltiple).

**Tabla:** `BroadcastUser` — pivote `Broadcast ↔ User` (difusiones a usuarios
específicos, Parte C). Espejo de `BroadcastRole` con la misma auditoría
(`active`, `createdById/updatedById`, `deactivatedAt/deactivatedById`);
`@@unique([broadcastId, userId])` + índices en ambas columnas. Al editar, las
filas que se quitan se **desactivan** (`active: false`), nunca se borran.

**Tabla:** `RoleBroadcastTarget` — pivote `Role (emisor) ↔ Role (destino)`: a
qué roles puede difundir cada rol. Sin filas, el emisor no llega a nadie (fail
closed); ROOT (`isSuperuser`) omite la tabla y llega a todos. Se edita desde
`/admin/roles/[id]` (sección "Puede difundir a", solo ROOT).

---

## Catálogo de eventos y matriz evento × canal

El registro único es `NOTIFICATION_EVENTS: Record<NotificationType, EventDef>`
(`src/lib/notifications/catalog.ts`): cada evento declara `label` (español,
para la matriz), `group` (Incidentes / Asignaciones / Vacaciones / Sistema),
`priority`, `defaultChannels` y `render(ctx)` (título, mensaje, link neutral y
`email: { subject, intro }`). Los tipos nuevos son strings planos
(`Notification.type` es `String`, no enum): agregar un evento es extender
`NOTIFICATION_TYPES` + una entrada del catálogo + una fila de política —
nunca una migración. `defaultChannelPolicies()` deriva las filas seed del
catálogo para que migración, seed y código no discrepen.

Matriz con sus valores por defecto (columna Correo = `defaultChannels.email`;
todo lo no listado es solo in-app):

| Evento | Grupo | In-App | Correo | Audiencia (fija en código) |
|---|---|:---:|:---:|---|
| `assignment_assigned` | Asignaciones | ✓ | — | FSRs agregados (solo los nuevos) |
| `assignment_updated` | Asignaciones | ✓ | — | FSRs asignados activos |
| `assignment_completed` | Asignaciones | ✓ | — | FSRs asignados + audiencia de operación |
| `assignment_reopened` | Asignaciones | ✓ | — | FSRs asignados activos |
| `incident_created` | Incidentes | ✓ | ✓ | Audiencia de operación del Cliente |
| `incident_updated` | Incidentes | ✓ | — | FSRs habilitados en el incidente |
| `incident_assigned` | Incidentes | ✓ | — | FSRs recién habilitados |
| `incident_phase_asignado` | Incidentes | ✓ | — | Reportante + operación del Cliente |
| `incident_phase_visto` | Incidentes | ✓ | — | Reportante + operación del Cliente |
| `incident_phase_iniciado` | Incidentes | ✓ | — | Reportante + operación del Cliente |
| `incident_phase_en_progreso` | Incidentes | ✓ | — | Reportante + operación del Cliente |
| `incident_closed` | Incidentes | ✓ | ✓ | Reportante + operación + FSRs asignados |
| `incident_cancelled` | Incidentes | ✓ | ✓ | Reportante + FSRs asignados + operación |
| `incident_reopened` | Incidentes | ✓ | — | Reportante + operación + FSRs asignados |
| `vacation_requested` | Vacaciones | ✓ | ✓ | Aprobadores (`vacations:approve`) |
| `vacation_approved` | Vacaciones | ✓ | ✓ | Solicitante |
| `vacation_rejected` | Vacaciones | ✓ | ✓ | Solicitante |
| `vacation_cancelled` | Vacaciones | ✓ | — | Según quién cancela (RF-470) |
| `vacation_starting_soon` | Vacaciones | ✓ | — | Solicitante (cron, idempotente) |
| `system` | Sistema | ✓ | — | Audiencia de la difusión |
| `announcement` | Sistema | ✓ | — | Audiencia de la difusión |

Correo por defecto solo para: incidente creado/cerrado/cancelado y vacación
solicitada/aprobada/rechazada. Las difusiones (`system`/`announcement`)
ignoran la matriz: el compositor elige Notificación/Correo por envío.

---

## Requisitos funcionales

### RF-450 · Creación de notificación individual

**Descripción:** El sistema crea una notificación para un usuario específico cuando ocurre un evento relevante. La operación la ejecuta el servidor internamente (no el usuario).

**Reglas de negocio:**
- `priority` tiene valor por defecto `NOTIFICATION_PRIORITY.LOW` (1) si no se especifica.
- `entityType` y `entityId` son opcionales y se usan para enlazar la notificación con una entidad específica (enfoque polimórfico).
- `actionUrl` define la ruta a la que navega el sistema al marcar la notificación como leída o al hacer clic en ella.
- `metadata` se almacena como JSON null si no se provee; nunca se omite el campo.

**Implementación:** `createNotification()` en `src/lib/notifications/notification-service.ts`

---

### RF-451 · Creación masiva de notificaciones

**Descripción:** El sistema envía la misma notificación a múltiples usuarios simultáneamente usando `prisma.notification.createMany`.

**Reglas de negocio:**
- Si `userIds` está vacío, la función retorna un arreglo vacío sin ejecutar consulta.
- Todos los registros comparten el mismo contenido de notificación; solo difieren en `userId`.

**Implementación:** `createNotificationsForUsers()` en `src/lib/notifications/notification-service.ts`

---

### RF-452 · Trigger: nueva asignación o reasignación

**Descripción:** Cuando se crea una asignación con FSRs, o cuando se actualiza una asignación y se agregan nuevos FSRs, el sistema notifica a cada FSR nuevo.

**Reglas de negocio:**
- Solo se notifica a los FSRs que se están **agregando** (no a los ya existentes ni a los que se eliminan).
- Tipo de notificación: `ASSIGNMENT_ASSIGNED`.
- Prioridad: `HIGH` (3).
- `entityType`: `"assignment"`, `entityId`: ID de la asignación.
- `actionUrl`: `/fsr/assignments/{assignmentId}`.
- Si `notifyAssignees` falla (error de notificación), el error se captura con `console.error` y no interrumpe el flujo principal — la asignación ya fue creada/actualizada correctamente.
- Cuando hay reasignación, `seenAt` y `seenById` se resetean a `null` en la asignación, ya que el nuevo FSR debe acusar recibo nuevamente.

**Escenario crítico:**
- DADO una asignación existente con FSR-A
- CUANDO un administrador agrega FSR-B a esa asignación
- ENTONCES FSR-B recibe una notificación `ASSIGNMENT_ASSIGNED` con `actionUrl = /fsr/assignments/{id}` y `priority = 3`; FSR-A NO recibe nueva notificación

**Implementación:** `notifyAssignmentAssigned()` en `src/lib/notifications/notify-events.ts` (fachada sobre `dispatch`)

---

### RF-453 · Consulta paginada de notificaciones del usuario actual

**Descripción:** Un usuario autenticado obtiene su lista de notificaciones, con soporte para paginación, filtrado por estado de lectura y filtrado por tipo.

**Reglas de negocio:**
- Requiere permiso `notifications:read`.
- Solo devuelve notificaciones con `active: true` (soft delete aplicado).
- Parámetros disponibles: `unreadOnly` (bool), `limit` (default 20), `offset` (default 0), `type` (filtro por tipo).
- Orden: `createdAt DESC`.

**Implementación:**
- Server Action: `getMyNotifications()` en `src/lib/actions/notifications.ts`
- API: `GET /api/notifications` (devuelve las últimas 20 + `unreadCount`)

---

### RF-454 · Conteo de notificaciones no leídas

**Descripción:** El sistema provee el conteo de notificaciones no leídas del usuario actual para mostrar badges en la interfaz.

**Reglas de negocio:**
- Requiere permiso `notifications:read`.
- Cuenta registros con `isRead: false` y `active: true`.
- Disponible como Server Action standalone (`getMyUnreadCount`) y combinado con la lista (`getNotificationsWithCount`) en una sola llamada paralela para la carga inicial.

**Implementación:** `getMyUnreadCount()` y `getNotificationsWithCount()` en `src/lib/actions/notifications.ts`

---

### RF-455 · Marcar notificación individual como leída

**Descripción:** Un usuario marca una notificación específica como leída. El sistema verifica propiedad antes de actualizar.

**Reglas de negocio:**
- Requiere permiso `notifications:update`.
- La verificación de propiedad (`userId` + `active: true`) se realiza antes de la actualización; si no existe, lanza error "Notification not found".
- Al marcar como leída, se registra `readAt = new Date()`.
- Solo acepta `PATCH /api/notifications/{id}` con body `{ isRead: true }`. Cualquier otro body retorna 400.

**Escenario crítico:**
- DADO un usuario que intenta marcar como leída una notificación de otro usuario
- CUANDO ejecuta `PATCH /api/notifications/{id}` con `{ isRead: true }`
- ENTONCES recibe 500 (el service lanza "Notification not found" porque la búsqueda filtra por `userId`)

**Implementación:** `markNotificationAsRead()` en `src/lib/actions/notifications.ts`; `PATCH /api/notifications/[id]/route.ts`

---

### RF-456 · Marcar todas las notificaciones como leídas

**Descripción:** Un usuario marca en bloque todas sus notificaciones no leídas como leídas.

**Reglas de negocio:**
- Requiere permiso `notifications:update`.
- Usa `updateMany` con filtro `{ userId, isRead: false, active: true }`.
- Establece `readAt = new Date()` en todos los registros afectados.

**Implementación:** `markAllNotificationsAsRead()` en `src/lib/actions/notifications.ts`; `POST /api/notifications/mark-all-read/route.ts`

---

### RF-457 · Eliminar notificación (soft delete individual)

**Descripción:** Un usuario elimina una notificación de su bandeja. La eliminación es lógica (`active: false`).

**Reglas de negocio:**
- Requiere permiso `notifications:delete`.
- Verifica propiedad antes de eliminar (busca por `notificationId` + `userId`); si no existe, lanza error.
- La notificación eliminada no aparece en consultas futuras (filtro `active: true`).

**Implementación:** `deleteMyNotification()` en `src/lib/actions/notifications.ts`; `DELETE /api/notifications/[id]/route.ts`

---

### RF-458 · Eliminar todas las notificaciones (soft delete masivo)

**Descripción:** El sistema puede eliminar lógicamente todas las notificaciones de un usuario.

**Reglas de negocio:**
- Usa `updateMany` con filtro `{ userId, active: true }`.
- No requiere verificación individual de propiedad (el filtro por `userId` garantiza pertenencia).

**Implementación:** `deleteAllNotifications()` en `src/lib/notifications/notification-service.ts`

---

### RF-459 · Notificaciones nativas del navegador

**Descripción:** El sistema puede mostrar notificaciones push nativas del navegador usando la Web Notifications API, con degradación elegante.

**Reglas de negocio:**
- Verifica soporte (`"Notification" in window`) antes de cualquier operación.
- Si el permiso es `"default"`, solicita permiso al usuario. Si ya es `"granted"` o `"denied"`, no vuelve a solicitarlo.
- Solo muestra la notificación nativa si el permiso está `"granted"`.
- El icono por defecto es `/icon-192x192.png`.
- La notificación nativa se cierra automáticamente a los 5 segundos.
- Al hacer clic: hace focus en la ventana, ejecuta callback `onClick` si existe, y cierra la notificación.
- Si la creación falla, captura el error con `console.error` y retorna `false`.

**Implementación:** `src/lib/notifications/browser-notifications.ts`

---

### RF-460 · API REST de notificaciones

**Descripción:** El sistema expone endpoints REST para gestión de notificaciones desde el cliente.

**Reglas de negocio:**

| Endpoint                                | Método | Permiso               | Descripción                                     |
|-----------------------------------------|--------|-----------------------|-------------------------------------------------|
| `/api/notifications`                    | GET    | `notifications:read`  | Lista últimas 20 + conteo no leídas             |
| `/api/notifications/{id}`               | GET    | `notifications:read`  | Obtiene notificación por ID (con verificación de propiedad) |
| `/api/notifications/{id}`               | PATCH  | `notifications:update`| Marca como leída (`{ isRead: true }`)           |
| `/api/notifications/{id}`               | DELETE | `notifications:delete`| Soft delete individual                          |
| `/api/notifications/mark-all-read`      | POST   | `notifications:update`| Marca todas como leídas                         |

---

### RF-461 · Entrega por correo vía outbox (SMTP / Mailpit)

**Descripción:** Qué eventos mandan correo lo decide la matriz (RF-472), no el
código. Cada correo es primero una fila en `EmailOutbox` y después un intento
de envío; sin `SMTP_HOST` la app registra lo que habría mandado y sigue (modo
noop para desarrollo).

**Reglas de negocio:**
- `dispatch` encola en el outbox cuando el canal correo está activo para el
  evento; `enqueueAndSend()` inserta la fila en `PENDIENTE` y la intenta
  enviar enseguida. Éxito → `ENVIADO`; fallo → `FALLIDO` con `attempts++` y
  `nextAttemptAt` con backoff (5 min, 30 min, 2 h; máximo 3 intentos, luego
  la fila descansa con `nextAttemptAt = null`). `retryDueEmails()` (cron,
  RF-474) reintenta vencidas y `PENDIENTE` atascadas.
- `lastError` guarda solo la clase del error (nombre + mensaje sanitizado,
  sin direcciones ni cuerpos) con tope de 300 caracteres.
- Transporte en `src/lib/mail/` (`SMTP_HOST/PORT/USER/PASS/FROM`; STARTTLS por
  defecto, TLS implícito con `SMTP_SECURE=true`); `verify()` comprueba la
  conexión, `send()` devuelve el `messageId` y envía un solo mensaje con BCC
  (nadie ve a los demás destinatarios). Plantilla HTML única `renderEmail()`
  (encabezado OpusTrack + botón al link neutral) más versión en texto.
- La suite e2e apunta el SMTP a Mailpit (`docker-compose.e2e.yml`,
  `config/e2e.env`) y `e2e/fixtures/mail.ts` afirma contra su API: las
  pruebas de correo prueban entrega real, no un mock.

**Implementación:** `src/lib/mail/outbox.ts`, `src/lib/mail/transport.ts`,
`src/lib/mail/templates.ts`

---

### RF-462 · Trigger: asignación actualizada

**Descripción:** En cada transición de asignación se notifica a los FSRs
asignados activos. Los FSRs agregados en la misma operación reciben
`ASSIGNMENT_ASSIGNED` (RF-452) en vez de esta.

**Reglas de negocio:**
- Tipo: `ASSIGNMENT_UPDATED`, prioridad `MEDIUM`.
- Destinatarios: FSRs activos de la asignación; el actor se excluye.
- Nunca lanza (contrato de `dispatch`, RF-471).

**Implementación:** `notifyAssignmentUpdated()` en `src/lib/notifications/notify-events.ts`

---

### RF-463 · Trigger: asignación completada

**Descripción:** Cuando la asignación transiciona a CERRADO se notifica a los
FSRs asignados y a la audiencia de operación.

**Reglas de negocio:**
- Tipo: `ASSIGNMENT_COMPLETED`, prioridad `HIGH`.
- Destinatarios: FSRs asignados activos + audiencia de operación; el actor se excluye.
- Nunca lanza.

**Implementación:** `notifyAssignmentCompleted()` en `src/lib/notifications/notify-events.ts`

---

### RF-464 · Trigger: asignación reabierta

**Descripción:** Cuando la asignación se reabre (CERRADO → EN_PROGRESO) se
notifica a los FSRs asignados activos.

**Reglas de negocio:**
- Tipo: `ASSIGNMENT_REOPENED`, prioridad `HIGH`.
- Destinatarios: FSRs asignados activos; el actor se excluye.
- Nunca lanza.

**Implementación:** `notifyAssignmentReopened()` en `src/lib/notifications/notify-events.ts`

---

### RF-465 · Trigger: incidente creado

**Descripción:** Tras persistir un incidente (alta individual o masiva) se
notifica a la audiencia de operación del Cliente del incidente.

**Reglas de negocio:**
- Tipo: `INCIDENT_CREATED`, prioridad `MEDIUM`, con correo por defecto.
- Destinatarios: `operationsAudience(clientId)` = tener `incidents:assign`
  (ROOT y ADMIN_OPERACION; FSR solo tiene `incidents:update`, así que el
  personal de campo deja de recibir avisos de otros centros) **y** alcanzar
  el Cliente (permiso `scope:all-clients` o `UserClientAssignment` activa
  en ese Cliente). Cliente nulo → solo alcance global. Fallo de resolución →
  nadie (fail closed). El actor se excluye.
- Nunca lanza; en los call sites se dispara post-transacción.

**Implementación:** `notifyIncidentCreated()` en
`src/lib/notifications/notify-events.ts`; audiencia en
`src/lib/notifications/audiences.ts`

---

### RF-466 · Trigger: incidente actualizado

**Descripción:** Tras editar los datos de un incidente se notifica a los FSRs
habilitados en él.

**Reglas de negocio:**
- Tipo: `INCIDENT_UPDATED`, prioridad `LOW`, sin correo por defecto.
- Destinatarios: FSRs habilitados (`IncidentAssignee` activos); el actor se excluye.
- Nunca lanza.

**Implementación:** `notifyIncidentUpdated()` en `src/lib/notifications/notify-events.ts`

---

### RF-467 · Trigger: incidente cerrado

**Descripción:** Solo cuando el incidente transiciona a CERRADO (puerta de
auto-cierre) se notifica a reportante, operación y FSRs.

**Reglas de negocio:**
- Tipo: `INCIDENT_CLOSED`, prioridad `HIGH`, con correo por defecto.
- Destinatarios: quien reportó + audiencia de operación del Cliente + FSRs
  habilitados; el actor se excluye.
- Nunca lanza.

**Implementación:** `notifyIncidentClosed()` en `src/lib/notifications/notify-events.ts`

---

### RF-468 · Trigger: FSR habilitado en incidente

**Descripción:** Cuando se habilitan nuevos FSRs en un incidente
(`ensureFsrsAssignedToIncident`, tracking) se les avisa. La elegibilidad sola
no notifica: antes pasaba que un FSR quedaba elegible sin enterarse.

**Reglas de negocio:**
- Tipo: `INCIDENT_ASSIGNED`, prioridad `MEDIUM`, sin correo por defecto.
- Destinatarios: solo los FSRs nuevos; el actor se excluye.
- Nunca lanza.

**Implementación:** `notifyIncidentAssigned()` en
`src/lib/notifications/notify-events.ts`

---

### RF-469 · Fases del incidente, cancelado, reapertura y links neutrales

**Descripción:** Las transiciones de fase del incidente notifican sin que los
16 call sites pasen `before/after` a mano: `syncIncidentState()` registra la
transición en el colector `after-commit` y el mapeador la enruta al evento.
Los links de incidente y vacación son neutrales al rol.

**Reglas de negocio:**
- Paso de fase hacia adelante (ASIGNADO / VISTO / INICIADO / EN_PROGRESO) →
  `incident_phase_*` a reportante + operación del Cliente. Prioridades:
  ASIGNADO/INICIADO/EN_PROGRESO `MEDIUM`, VISTO `LOW`. Sin correo por defecto.
- Entrada a CERRADO → `incident_closed` (RF-467). Salida de CERRADO →
  `incident_reopened` a reportante + operación + FSRs. Cualquier otro
  retroceso (p. ej. ASIGNADO → ABIERTO) no notifica. `CANCELADA` nunca pasa
  por el sync: `cancelIncident()` dispara `incident_cancelled` post-commit a
  reportante + FSRs + operación, con correo por defecto.
- `withDeferredNotifications(fn)` / `transactionWithNotifications(fn)`:
  lo registrado con `deferAfterCommit` dentro de un `prisma.$transaction` se
  despacha solo si la transacción hace commit; en rollback se descarta en
  silencio. Sin colector abierto se despacha directo. Anidado seguro (el
  interior se une al colector exterior). El flush nunca lanza.
- Links neutrales: todo `actionUrl` de incidente/vacación (in-app y correo)
  apunta a `/notifications/go/[entity]/[id]`; el Route Handler resuelve el
  destino contra las rutas del usuario actual (`getMyAccessibleRoutes()`):
  incidente → `/admin/incidents/{id}` | `/reporter/incidents/{id}` |
  `/fsr/incidents`; vacación → `/admin/vacations` | `/vacations`. Sin
  candidato → 404, nunca una fuga. Esto corrige el link roto que mandaba al
  REPORTER a `/admin/incidents/{id}`.

**Implementación:** `src/lib/notifications/after-commit.ts`,
`notifyIncidentTransition()` / `notifyIncidentPhase()` /
`notifyIncidentReopened()` / `notifyIncidentCancelled()` en
`src/lib/notifications/notify-events.ts`,
`src/lib/notifications/go-links.ts` + `src/app/notifications/go/[entity]/[id]/route.ts`

---

### RF-470 · Notificaciones de vacaciones

**Descripción:** Solicitud, decisión, cancelación y recordatorio de inicio,
con audiencia fija en código y canal según la matriz.

**Reglas de negocio:**

| Tipo | Cuándo | Destinatarios |
|---|---|---|
| `vacation_requested` | `createVacation` | Aprobadores (`vacations:approve`); el actor se excluye |
| `vacation_approved` / `vacation_rejected` | decisión (`resolveVacation`) | Solicitante (auto-aprobación queda en silencio por exclusión del actor) |
| `vacation_cancelled` | `deleteVacation` (soft-delete) | Si cancela el propio solicitante → aprobadores (con su nombre en el texto); si cancela un admin la de otro → el solicitante |
| `vacation_starting_soon` | Cron (RF-474): vacación APROBADA que empieza mañana (día calendario CDMX) | Solicitante. Idempotente: si ya existe una `Notification` de ese tipo para esa vacación se omite (los corridos solapados nunca duplican) |

- Correo por defecto: solicitada/aprobada/rechazada; cancelada y
  `starting_soon` solo in-app. Detalle de cancelación y recordatorio en
  `spec/10-festivos-vacaciones.md`.
- Nunca lanzan.

**Implementación:** `notifyVacationRequested()` /
`notifyVacationApproved()` / `notifyVacationRejected()` /
`notifyVacationCancelled()` en `src/lib/notifications/notify-events.ts`;
`sendVacationStartingSoonReminders()` en
`src/lib/notifications/vacation-reminders.ts`

---

### RF-471 · Embudo único de despacho (`dispatch`)

**Descripción:** Todo evento automático fluye por `dispatch(type, { recipients,
actorId, ctx, includeActor?, entity, broadcastId?, channels? })`, que renderiza
el texto desde el catálogo, consulta la política y entrega. Reemplaza al
`emit()`/`emailRecipients()` anterior.

**Reglas de negocio:**
- Deduplica destinatarios y excluye al actor (salvo `includeActor`, p. ej.
  "Enviarme una copia"). Audiencia vacía o ambos canales apagados → no hace nada.
- La política se cachea en memoria 60 s (`clearChannelPolicyCache()` al
  guardar la matriz); fila ausente o fallo de lectura → defaults del catálogo
  (una base fresca se comporta igual que una sembrada).
- In-app va por `createNotificationsForUsers`; correo por `enqueueAndSend`
  (RF-461). El correo no depende del in-app: si la escritura in-app falla, el
  correo igual sale. `channels` explícito (difusiones) omite la matriz.
- **Nunca lanza**: un fallo de notificación jamás revierte la operación de
  negocio que la disparó. `notify-events.ts` queda como fachada delgada con
  los mismos nombres públicos para no mover los ~20 call sites.

**Implementación:** `src/lib/notifications/dispatch.ts`

---

### RF-472 · Matriz de canales + SMTP (`/admin/settings/notifications`, solo ROOT)

**Descripción:** Solo el admin decide los canales de los eventos automáticos:
matriz agrupada por dominio (evento × [Notificación] [Correo]). Sin
preferencias por usuario. En la misma página vive el bloque SMTP.

**Reglas de negocio:**
- Requiere `notifications:configure` (ruta `/admin/settings/notifications`,
  solo ROOT). Guardar escribe `NotificationChannelPolicy`, registra en
  `logAudit` e invalida la caché de `dispatch`.
- Bloque SMTP: estado del transporte (`smtp(host:port)` o `noop`), botón
  **"Enviar correo de prueba"** a la propia dirección (usa `verify` + `send`)
  y lista de correos fallidos con opción **Reintentar** (re-encola vía
  `retryDueEmails`).
- La ruta cuelga de `/admin/settings/…` (igual que `vacation-accrual`) para
  que el prefijo `/admin/notifications` de difusiones no la cubra.

**Implementación:** `src/app/admin/settings/notifications/`

---

### RF-473 · Difusiones (`/admin/notifications`)

**Descripción:** Comunicados persistidos a roles destinatarios **o a usuarios
específicos**, de envío inmediato o programado, con alcance limitado por el
rol emisor. Reemplaza al `sendBroadcast` anterior (un solo rol, sin canal,
sin programación, sin historial; exigía apenas `notifications:read`, así que
cualquier autenticado podía difundir — hueco cerrado exigiendo
`notifications:broadcast`).

**Reglas de negocio:**
- Acciones `createBroadcast`, `updateBroadcast` (solo `PROGRAMADA`),
  `cancelBroadcast`, `listBroadcasts`, `getMyBroadcastTargets`,
  `searchBroadcastRecipients` en `src/lib/actions/broadcasts.ts`; todas exigen
  `notifications:broadcast` (ruta `/admin/notifications`; ROOT,
  ADMIN_OPERACION, ADMIN_VACACIONES) y devuelven `rejected("…")` en español,
  nunca lanzan:
  - al menos un canal (Notificación / Correo);
  - al menos un destinatario: "todos" (solo si el emisor alcanza todos los
    roles), o uno o más roles, o uno o más usuarios específicos;
  - roles ⊆ destinos permitidos del emisor = unión de `RoleBroadcastTarget`
    de sus roles (sin configuración no llega a nadie; ROOT omite la tabla);
  - cada usuario específico debe tener un rol activo dentro de los destinos
    permitidos del emisor **y**, si el emisor no tiene `scope:all-clients`,
    compartir al menos un Cliente activo con él (`UserClientAssignment`);
    ROOT (`isSuperuser`) alcanza a cualquiera. Sin roles alcanzables tampoco
    hay usuarios alcanzables (fail closed). Fuera de alcance →
    `"No puedes difundir a uno o más de los usuarios seleccionados"`;
  - `scheduledAt` futuro (reloj CDMX, se guarda UTC).
- El alcance se valida **al crear y al editar, no en el despacho**
  (decisión #3): si un usuario pierde el rol antes del envío programado, la
  difusión igual le llega. Lo que sí se filtra al enviar es
  `user.active`: un usuario dado de baja entre la programación y el envío no
  recibe nada.
- `searchBroadcastRecipients(query)` respalda el selector: mínimo 2
  caracteres, tope 20, devuelve `{ id, name, email, roleNames }` **solo** de
  usuarios dentro del alcance — nunca revela a nadie fuera de él.
- Los destinatarios se calculan **al enviar**, no al crear. Enviar ahora =
  crear + despachar en la misma request; programar = queda `PROGRAMADA` para
  el cron. El despacho reclama la fila atómicamente (`updateMany where
  status=PROGRAMADA → ENVIANDO`): dos corridas la envían una sola vez; el
  perdedor ve `count: 0` y no envía nada. La audiencia es la **unión sin
  duplicados** de los roles (`BroadcastRole` activos) y los usuarios
  (`BroadcastUser` activos, solo `user.active`); `ANNOUNCEMENT` respeta la
  misma audiencia (el tipo solo define prioridad y etiqueta, a diferencia del
  path anterior que forzaba todo anuncio a todos). Opción **"Enviarme una
  copia"** (`includeSender`).
- UI: compositor (título, mensaje, tipo, canales, tres modos excluyentes —
  **Todos** / **Por rol** / **Usuarios específicos** con buscador y chips
  removibles —, "Enviar ahora"/"Programar", vista previa de destinatarios) +
  tabla Programadas/Historial (estado, canales, destinatarios con usuarios
  como nombre + correo, tope 5 más "y N más", editar/cancelar).
  `/admin/roles/[id]`: sección **"Puede difundir a"** (solo ROOT,
  `assertCanManageRoles`).
- Alcance sembrado: ADMIN_OPERACION → FSR, REPORTER, GUEST, ADMIN_OPERACION;
  ADMIN_VACACIONES → EMPLEADO, FSR, ADMIN_OPERACION, ADMIN_VACACIONES.

**Implementación:** `src/lib/actions/broadcasts.ts`,
`src/lib/notifications/broadcast-dispatch.ts`,
`src/components/notifications/broadcast-form.tsx`,
`src/app/admin/notifications/`

---

### RF-474 · Cron (`/api/cron/notifications`)

**Descripción:** Route Handler `GET` con secreto compartido que ejecuta las
tres tareas pendientes de forma idempotente y devuelve el resumen en JSON.

**Reglas de negocio:**
- Exige `Authorization: Bearer ${CRON_SECRET}` (formato Vercel Cron);
  `/api/cron/*` está exento del requisito de sesión en `src/middleware.ts`.
  Secreto ausente, malformado o incorrecto (o `CRON_SECRET` sin configurar)
  → mismo 401 genérico.
- Cada corrida: (1) difusiones vencidas (`dispatchDueBroadcasts`, reclamo
  atómico ⇒ exactamente una vez), (2) `retryDueEmails()`, (3) recordatorios
  `vacation_starting_soon`. Errores aislados por tarea; cada resumen cuenta
  `{ broadcasts: { claimed, delivered }, emails: { attempted, sent, failed },
  vacationReminders: { checked, sent, skipped } }`.
- `vercel.json` → `crons: [{ path: "/api/cron/notifications", schedule:
  "0 13 * * *" }]`, un cron **diario** (07:00 CDMX): Vercel Hobby rechaza el
  deployment completo si la expresión corre más de una vez al día. La cadencia
  real de 5 min la da `.github/workflows/cron-notifications.yml` con `curl` y
  el secreto (el endpoint no distingue el cliente HTTP), sujeta a los atrasos
  de los horarios de GitHub Actions. Necesita la variable `PRODUCTION_URL` y el
  secreto `CRON_SECRET` en el repositorio. Desarrollo local:
  `npm run cron:notifications` (llama al endpoint con el secret de `.env`).
- Variable nueva: `CRON_SECRET`. SMTP ya existía.

**Implementación:** `src/app/api/cron/notifications/route.ts`,
`vercel.json`, `scripts/cron-notifications.mjs`

---

### RF-475 · Bandeja universal y campana

**Descripción:** Una sola bandeja para todos los roles y campana también en
escritorio (antes la campana solo existía en el header móvil y la única
bandeja era `/fsr/notifications`).

**Reglas de negocio:**
- `src/app/notifications/` (`requireRouteAccess("/notifications")`, permiso
  `route:notifications` en todos los roles) con filtros leídas/no
  leídas/tipo y paginación. Redirect permanente
  `/fsr/notifications/:path*` → `/notifications/:path*` (`next.config.ts`).
- `NotificationBell` en `AppShell` (móvil) y en `AppSidebar` (escritorio);
  "Ver todas" lleva a `/notifications`. Entrada **"Mis Notificaciones"** en
  la sección "Resumen" del menú (se filtra por ruta, aparece para todos).
  En Gestión de Usuarios "Enviar Notificación" pasa a "Difusiones"; en
  Configuración se agrega "Canales de notificación".

**Implementación:** `src/app/notifications/`, `src/components/layout/`,
`src/lib/navigation/menu.ts`, `next.config.ts`

---

## Reglas transversales aplicables

- **Propiedad**: ninguna operación de lectura, actualización o eliminación opera sobre notificaciones de otro usuario. La verificación de `userId` es obligatoria en todas las operaciones individuales.
- **Soft delete global**: el campo `active` sigue el patrón del proyecto; registros con `active: false` se excluyen de todas las consultas normales. (`NotificationChannelPolicy`, `EmailOutbox`, `Broadcast`/`BroadcastRole`/`RoleBroadcastTarget` siguen su propia forma: configuración y log no se borran, ver Modelo de datos.)
- **Notificaciones como efecto secundario**: la creación de notificaciones es siempre un efecto secundario de otra operación de negocio. Un fallo en la notificación no revierte la operación principal (`dispatch` nunca lanza; el colector `after-commit` solo despacha tras commit).
- **Audiencias por capacidad, no por nombre**: el código nunca compara nombres de rol para decidir a quién avisa; usa `whereHasPermission()` / `whereHasRoleId()` (`src/lib/authz/user-queries.ts`). Quién es notificado sigue a quién puede actuar.
- **Sin enrutamiento por prioridad en UI**: la prioridad (1/2/3) está disponible en el modelo y se usa en reportes (ver RF-511), pero la lógica de presentación diferenciada por prioridad no está implementada en los Server Actions o API (solo en el reporte de engagement).

---

## Cobertura de pruebas

- `src/lib/notifications/dispatch.test.ts` — respeta la matriz, excluye al actor, nunca lanza aunque fallen BD o SMTP.
- `src/lib/notifications/audiences.test.ts` — operación por Cliente, FSR fuera de `incident_created`.
- `src/lib/notifications/after-commit.test.ts` — rollback ⇒ nada se notifica.
- `src/lib/notifications/notify-events.test.ts`, `notify-transitions.test.ts` — fachada y mapeo de transiciones.
- `src/lib/notifications/broadcast-dispatch.test.ts` — validación de alcance (fail closed), reclamo atómico (dos corridas, un envío), usuarios directos en la audiencia.
- `src/lib/actions/broadcasts.test.ts` — validación de `userIds` (solo directos, ninguno, fuera de alcance, sin Cliente compartido, ROOT), búsqueda acotada, vista previa en unión, desactivación al editar.
- `src/test/integration/broadcasts-users.int.test.ts` — alcance por roles+Cliente con rol dedicado (sin `scope:all-clients`), búsqueda sin revelar fuera, unión sin duplicados, inactivo fuera, idempotencia por reclamo, desactivación al editar.
- `e2e/broadcast-users.spec.ts` — difusión a un usuario específico: la ve en `/notifications`, otro usuario no la recibe.
- `src/lib/mail/outbox.test.ts` — backoff y máximo de intentos.
- `src/lib/notifications/vacation-reminders.test.ts` — idempotencia del recordatorio.
- `src/lib/notifications/go-links.test.ts` — resolución de destinos neutrales.
- `e2e/notifications-mail.spec.ts` (Mailpit real) — EMPLEADO solicita → ADMIN_VACACIONES recibe notificación y correo; apagar el correo de `incident_created` en la matriz ⇒ Mailpit no recibe nada; difusión programada + cron con secret ⇒ bandeja y Mailpit; sin secret ⇒ 401.
- `e2e/rbac-roles.spec.ts` — ADMIN_OPERACION no puede elegir EMPLEADO como destino; GUEST recibe rechazo al difundir; cada rol ve su campana en escritorio y en `/notifications`.

---

## RF rango registrado

RF-450 – RF-479: Notificaciones (este dominio).
