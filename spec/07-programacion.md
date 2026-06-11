# 07 · Programación (Schedules)

> OpusTrack — especificación de dominio. Índice: spec/README.md

## Propósito

Gestionar programaciones de visitas, calibraciones y mantenimientos en Clientes. Cada programación puede abarcar un rango de fechas, agrupar múltiples Clientes y contener incidentes vinculados. La vista `/admin/programacion` es el centro de trabajo del módulo: permite navegar por un calendario semanal/mensual y gestionar incidentes dentro de cada programación.

---

## Modelo de datos

### Schedule

| Campo         | Tipo           | Restricciones                          | Descripción                                      |
|---------------|----------------|----------------------------------------|--------------------------------------------------|
| `id`          | String         | PK, CUID                               | Identificador único                              |
| `title`       | String         | requerido                              | Título de la programación                        |
| `description` | String?        | opcional                               | Descripción opcional                             |
| `scheduledAt` | DateTime       | requerido                              | Fecha/hora de inicio de la programación          |
| `endDate`     | DateTime?      | opcional                               | Fecha/hora de fin (si es null, es puntual)       |
| `statusId`    | Int?           | FK → ScheduleStatus, opcional          | Estado de la programación                        |
| `active`      | Boolean        | default true                           | Soft delete                                      |

**Índices:** `statusId`, `scheduledAt`, `endDate` (para consultas de rango eficientes).

### ScheduleCliente (tabla de unión)

| Campo        | Tipo    | Restricciones              | Descripción                     |
|--------------|---------|----------------------------|---------------------------------|
| `scheduleId` | String  | PK compuesta, FK → Schedule| Programación                    |
| `clienteId`  | String  | PK compuesta, FK → Cliente | Cliente participante            |
| `active`     | Boolean | default true               | Soft delete de la relación      |
| `createdAt`  | DateTime| default now()              | Fecha de asociación             |

La relación `Schedule ↔ Cliente` es M-N a través de esta tabla. `onDelete: Cascade` en el lado de `Schedule`.

### ScheduleStatus (catálogo)

| Nombre       | Color     | Descripción                                     |
|--------------|-----------|-------------------------------------------------|
| `BORRADOR`   | `#94A3B8` | Schedule en edición, no confirmado (gris)       |
| `CONFIRMADO` | `#3B82F6` | Schedule confirmado, listo para ejecutar (azul) |
| `EN_CURSO`   | `#F59E0B` | Schedule en ejecución (ámbar)                   |
| `COMPLETADO` | `#10B981` | Schedule completado exitosamente (verde)         |
| `CANCELADO`  | `#EF4444` | Schedule cancelado (rojo)                       |
| `POSPUESTO`  | `#8B5CF6` | Schedule pospuesto para otra fecha (violeta)    |

El campo `color` es hexadecimal y se usa para renderizar badges en UI.

### Relación con Incident

`Incident.scheduleId` (FK → Schedule, opcional) permite vincular un incidente a una programación. Un Schedule puede tener múltiples incidentes (`Schedule.incidents[]`); un incidente pertenece a cero o un schedule.

---

## Requisitos funcionales

### RF-400 · Listar programaciones con filtros y paginación

**Descripción:** El sistema devuelve programaciones activas con soporte de paginación, búsqueda por texto, filtro por Cliente y filtro de estado. El filtro de rango de fechas usa lógica de solapamiento.

**Reglas de negocio:**
- Se requiere permiso `schedules:read`.
- El filtro por rango (`activeFrom`/`activeTo`, también aceptados como `startDate`/`endDate` en la API) usa lógica de solapamiento: se devuelven programaciones cuyo intervalo `[scheduledAt, endDate]` se intersecta con el rango solicitado.
- Un schedule sin `endDate` se trata como puntual: solo solapa si `scheduledAt` está dentro del rango.
- La búsqueda por texto (`search`) aplica `ilike` sobre `title` y `description`.
- El filtro por `clienteId` verifica que el schedule tenga al menos un `ScheduleCliente` activo con ese cliente.
- Paginación por defecto: página 1, 10 registros por página.
- La respuesta incluye conteo de incidentes vinculados (`_count.incidents`).

**Escenario crítico — filtro de solapamiento:**
- DADO una programación con `scheduledAt = 2026-06-10` y `endDate = 2026-06-20`
- CUANDO se consulta con `activeFrom = 2026-06-15` y `activeTo = 2026-06-25`
- ENTONCES la programación aparece en los resultados (el intervalo `[10, 20]` se solapa con `[15, 25]`)

---

### RF-401 · Consultar detalle de una programación

**Descripción:** Devuelve la información completa de una programación, incluyendo los Clientes activos vinculados y los incidentes activos asociados.

**Reglas de negocio:**
- Se requiere permiso `schedules:read`.
- Los incidentes incluidos tienen `active: true`, ordenados por `reportedAt` descendente.
- Los Clientes incluidos son aquellos con `active: true` en la tabla `ScheduleCliente`.
- Cada incidente incluye tipo, estado, y datos del usuario que lo reportó.

---

### RF-402 · Crear una programación

**Descripción:** Crea una nueva programación, opcionalmente con Clientes vinculados, en una operación atómica.

**Reglas de negocio:**
- Se requiere permiso `schedules:create`.
- `clienteIds` es **opcional**: puede ser un arreglo vacío. Una programación sin Clientes es válida y se trata como "global" (sin restricción de Cliente).
- Se eliminan duplicados en `clienteIds` antes de procesarlos (`new Set()`).
- El usuario debe tener acceso a cada Cliente indicado (`canAccessCliente`). Si no, se lanza error "Sin acceso al Cliente {id}".
- La creación del `Schedule` y los registros `ScheduleCliente` ocurren en una única transacción (`$transaction`).
- Se usa `skipDuplicates: true` al crear los `ScheduleCliente`.
- Después de crear, se invalida caché de `/admin/schedules` y `/admin/programacion`.

---

### RF-403 · Actualizar una programación (full update)

**Descripción:** Actualiza todos los campos de una programación existente y sincroniza los Clientes vinculados.

**Reglas de negocio:**
- Se requiere permiso `schedules:update`.
- `clienteIds` es **opcional**: puede ser un arreglo vacío. Enviar `[]` desvincula todos los Clientes activos del schedule (queda como "global").
- La sincronización de Clientes (`syncScheduleClientes`) es incremental:
  - Clientes en `currentActive` que no están en `desired` → se desactivan (`active: false`).
  - Clientes en `currentInactive` que vuelven a `desired` → se reactivan (`active: true`).
  - Clientes nuevos que no existían → se crean.
  - Esta lógica preserva el historial de relaciones en lugar de borrar y recrear.
- La actualización ocurre en una única transacción.
- Después de actualizar, se invalida caché de `/admin/schedules`, `/admin/schedules/{id}` y `/admin/programacion`.

---

### RF-404 · Actualización rápida desde calendario (quickUpdateSchedule)

**Descripción:** Permite actualizar solo los Clientes y el rango de fechas desde la vista de calendario, sin tocar título ni descripción.

**Reglas de negocio:**
- Se requiere permiso `schedules:update`.
- Si `endDate` se provee y es anterior a `scheduledAt`, se lanza error "La fecha de fin no puede ser anterior a la fecha de inicio".
- `clienteIds` es **opcional**: puede ser un arreglo vacío. Enviar `[]` desvincula todos los Clientes activos del schedule (queda como "global").
- Usa la misma lógica de sincronización incremental de `ScheduleCliente` que RF-403.

---

### RF-405 · Eliminar una programación (soft delete)

**Descripción:** Elimina lógicamente una programación. No se puede eliminar si tiene incidentes activos vinculados.

**Reglas de negocio:**
- Se requiere permiso `schedules:delete`.
- Si la programación tiene incidentes activos (`active: true`), se lanza error con el conteo: "Cannot delete schedule. {n} incident(s) are linked to this schedule."
- La eliminación es soft delete (`active: false`).
- Después de eliminar, se redirige a `/admin/schedules`.

---

### RF-406 · Obtener Clientes disponibles para formulario de programación

**Descripción:** Devuelve los Clientes activos accesibles por el usuario autenticado, para poblar el selector del formulario.

**Reglas de negocio:**
- Se requiere permiso `schedules:read`.
- El resultado se filtra con `getClienteWhereClause(user)`, que restringe los Clientes según el rol y los Clientes asignados al usuario.
- Ordenado por nombre ascendente.

---

### RF-407 · Consultar incidentes en rango de fechas para el calendario

**Descripción:** El endpoint `GET /api/schedules/incidents` devuelve incidentes para renderizar en el calendario de la vista de programación. Incluye tanto incidentes vinculados a programaciones (que se solapan con el rango) como incidentes sin programación reportados en el rango.

**Reglas de negocio:**
- Se requiere permiso `schedules:read`.
- Los parámetros `start` y `end` (ISO 8601) son obligatorios. Sin ellos, devuelve HTTP 400.
- Si las fechas no son válidas, devuelve HTTP 400 "Formato de fecha inválido. Use ISO 8601 (YYYY-MM-DD)".
- La lógica de inclusión es una OR de dos condiciones:
  1. Incidentes cuyo `schedule` activo se solapa con `[start, end]` (mismo algoritmo de solapamiento que RF-400).
  2. Incidentes sin `scheduleId` cuyo `reportedAt` cae dentro de `[start, end]`.
- El filtro opcional `clienteId` restringe por `Incident.clienteId`.
- La respuesta incluye tipo, estado, Cliente, schedule, reportedBy, línea, equipo, asignaciones con assignees y conteo de assignees.
- Los incidentes se ordenan por `reportedAt` ascendente.

**Escenario crítico — incidentes sin programación en el calendario:**
- DADO un incidente con `scheduleId = null` y `reportedAt = 2026-06-12`
- CUANDO se consulta el calendario con `start = 2026-06-10` y `end = 2026-06-15`
- ENTONCES el incidente aparece en la respuesta (satisface la segunda condición de la OR)

---

### RF-408 · Vista de programación con calendario interactivo (/admin/programacion)

**Descripción:** La página `/admin/programacion` es un cliente interactivo (Client Component) que combina un calendario (`ScheduleCalendar`) y un panel de actividades (`ScheduleActivities`). Permite seleccionar rangos de fechas y gestionar incidentes en contexto de una programación.

**Reglas de negocio:**
- La vista carga el rango de la semana actual como estado inicial (`currentWeekRange()`).
- Los Clientes se cargan mediante `GET /api/clientes` al montar el componente.
- El usuario puede navegar en modo día, semana, mes o rango personalizado.
- Si se selecciona una programación existente (`SelectScheduleDialog`), el rango del calendario se ajusta automáticamente al `[scheduledAt, endDate]` de esa programación.
- El botón de creación es contextual:
  - Si hay una programación seleccionada → abre `CreateIncidentDialog` para crear un incidente vinculado a esa programación.
  - Si el modo es "día" (sin programación seleccionada) → abre `CreateIncidentDialog` para el día seleccionado.
  - En cualquier otro caso → abre `CreateProgramDialog` para crear una nueva programación.
- El calendario es colapsable en desktop (oculto/visible mediante toggle), siempre visible en mobile (ocupa la parte superior).

---

### RF-409 · Control de acceso a Clientes en schedules

**Descripción:** Las operaciones de creación y modificación verifican que el usuario tenga acceso a cada Cliente que intenta asociar a una programación.

**Reglas de negocio:**
- La verificación usa `canAccessCliente(user, clienteId)` del módulo de filtros de autenticación.
- Si el usuario intenta asociar un Cliente al que no tiene acceso, se lanza error inmediatamente ("Sin acceso al Cliente {id}").
- El ADMINISTRADOR tiene acceso a todos los Clientes.
- Los demás roles solo tienen acceso a los Clientes explícitamente asignados.
- Un schedule **sin Clientes vinculados** es considerado "global": cualquier usuario puede acceder a él en operaciones de lectura y en la asignación de incidentes. La verificación de acceso a Clientes se omite cuando el schedule no tiene ningún `ScheduleCliente` activo.

---

## Estados y transiciones de ScheduleStatus

Los estados son manuales: no hay transiciones automáticas en el código actual. El administrador los cambia explícitamente al crear o editar una programación.

| Estado       | Color     | Significado operativo                           |
|--------------|-----------|-------------------------------------------------|
| `BORRADOR`   | Gris      | En edición, no visible para ejecución           |
| `CONFIRMADO` | Azul      | Aprobado, listo para ejecutarse                 |
| `EN_CURSO`   | Ámbar     | Ejecución activa                                |
| `COMPLETADO` | Verde     | Finalizado exitosamente                         |
| `CANCELADO`  | Rojo      | No se ejecutará                                 |
| `POSPUESTO`  | Violeta   | Reagendado                                      |

---

## Reglas transversales aplicables

- **Soft delete universal**: `Schedule.active = false` nunca elimina `ScheduleCliente` ni incidentes; estos conservan su estado.
- **Integridad referencial en eliminación de Schedule**: `ScheduleCliente` tiene `onDelete: Cascade` en el lado de `scheduleId`, por lo que los registros de unión se borran físicamente si el Schedule se borrara físicamente (esto no ocurre con soft delete).
- **`statusId` opcional en Schedule**: un schedule puede crearse sin estado (`statusId: null`), lo que es semánticamente distinto de `BORRADOR`.
- **`endDate` opcional**: si `endDate` es null, el schedule es puntual. La lógica de solapamiento trata este caso como `scheduledAt = endDate` para fines de filtrado.
- **Sincronización incremental de Clientes**: la función `syncScheduleClientes` no borra ni crea ciegamente, sino que reutiliza registros inactivos y desactiva los que salen. Esto preserva el historial de la relación.
- **Historial de `ScheduleType` eliminado**: una migración previa (`20260509070000_add_schedule_type`) agregó un enum `ScheduleType` (DIARIA | MENSUAL) al modelo Schedule. Una migración posterior (`20260515103000_schedule_multi_vic`) eliminó ese tipo y la columna. El esquema actual **no tiene campo `type` en Schedule**.
- **Permisos de escritura**: `schedules:create`, `schedules:update` y `schedules:delete` se asignan solo al rol ADMINISTRADOR. Los roles FSR, CLIENT y GUEST tienen únicamente `schedules:read`.
