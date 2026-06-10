# 08 · Notificaciones

> OpusTrack — especificación de dominio. Índice: spec/README.md

## Propósito

Informar a los usuarios (principalmente FSRs) sobre eventos relevantes del sistema — nuevas asignaciones, reasignaciones, cambios en incidentes — sin que tengan que consultar activamente la interfaz. Las notificaciones son persistentes (base de datos), con soporte opcional para notificaciones nativas del navegador.

---

## Modelo de datos

**Tabla:** `Notification` (`prisma/schema.prisma`, línea 527)

| Campo        | Tipo          | Descripción                                                        |
|--------------|---------------|--------------------------------------------------------------------|
| `id`         | String (cuid) | Identificador único                                                |
| `userId`     | String        | Receptor de la notificación (FK → User)                            |
| `title`      | String        | Título breve (ej.: "Nueva asignación")                             |
| `message`    | String        | Cuerpo del mensaje                                                 |
| `type`       | String        | Tipo de evento (ver constantes `NOTIFICATION_TYPES`)               |
| `entityType` | String?       | Tipo de entidad vinculada: `assignment`, `incident`, `user`, `schedule` |
| `entityId`   | String?       | ID de la entidad vinculada (polimórfico)                           |
| `actionUrl`  | String?       | Ruta de navegación al hacer clic                                   |
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

**Constantes de tipo** (`notification-types.ts`):

```
ASSIGNMENT_ASSIGNED   — asignación creada con FSRs
ASSIGNMENT_UPDATED    — asignación modificada
ASSIGNMENT_COMPLETED  — asignación cerrada
ASSIGNMENT_REOPENED   — asignación reabierta
INCIDENT_CREATED      — incidente nuevo
INCIDENT_UPDATED      — incidente actualizado
INCIDENT_CLOSED       — incidente cerrado
INCIDENT_ASSIGNED     — incidente vinculado a FSR
SYSTEM                — notificación del sistema
ANNOUNCEMENT          — comunicado general
```

**Constantes de entidad:** `assignment`, `incident`, `user`, `schedule`

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

**Implementación:** `notifyAssignees()` (función interna) en `src/lib/actions/assignments.ts`

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

## Reglas transversales aplicables

- **Propiedad**: ninguna operación de lectura, actualización o eliminación opera sobre notificaciones de otro usuario. La verificación de `userId` es obligatoria en todas las operaciones individuales.
- **Soft delete global**: el campo `active` sigue el patrón del proyecto; registros con `active: false` se excluyen de todas las consultas normales.
- **Notificaciones como efecto secundario**: la creación de notificaciones es siempre un efecto secundario de otra operación de negocio (crear/actualizar asignación). Un fallo en la notificación no revierte la operación principal.
- **Sin enrutamiento por prioridad en UI**: la prioridad (1/2/3) está disponible en el modelo y se usa en reportes (ver RF-511), pero la lógica de presentación diferenciada por prioridad no está implementada en los Server Actions o API (solo en el reporte de engagement).
