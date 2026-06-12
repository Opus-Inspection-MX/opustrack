# 09 · Reportes, Tracking y Dashboard

> OpusTrack — especificación de dominio. Índice: spec/README.md

## Propósito

Proveer visibilidad operativa y analítica al administrador sobre el desempeño de FSRs, el estado de asignaciones e incidentes, la utilización de partes, el cumplimiento de viajes, y el nivel de atención a notificaciones. El módulo de tracking permite además gestión activa de incidentes y asignaciones en tiempo real desde una vista centralizada.

---

## Fuentes de datos

| Entidad           | Modelo Prisma         | Uso principal                                        |
|-------------------|-----------------------|------------------------------------------------------|
| `Incident`        | Incident              | Tendencia, distribución por tipo, tracking           |
| `Assignment`      | Assignment            | Rendimiento FSR, aging, seen-time, tracking          |
| `AssignmentStatus`| AssignmentStatus      | Distribución de estados                              |
| `VehicleTrip`     | VehicleTrip           | Viajes por día/FSR, cumplimiento diario              |
| `WorkPart`        | WorkPart              | Uso de partes                                        |
| `Notification`    | Notification          | Engagement de notificaciones                         |
| `User` (FSR)      | User (role = FSR)     | Todos los reportes de FSR                            |

**Zona horaria:** Todos los reportes con manejo explícito de fechas usan `America/Mexico_City` via `moment-timezone`. Los reportes más simples usan UTC nativo de JavaScript (sin conversión).

**Permiso requerido:** `reports:view` para todos los reportes. `dashboard:view` para el dashboard. `tracking:read` y `tracking:update` para el módulo de tracking.

**Rango por defecto:** Cuando no se proporcionan fechas, todos los reportes calculan los últimos 30 días (o 7 días en el caso de cumplimiento diario de viajes).

---

## Requisitos funcionales

### RF-500 · Dashboard administrativo

**Descripción:** Vista de inicio del administrador con métricas de operación en tiempo real.

**Reglas de negocio:**
- Requiere permiso `dashboard:view`.
- Ejecuta 6 consultas en paralelo (`Promise.all`):
  1. `totalUsers` — usuarios activos en el sistema
  2. `activeIncidents` — incidentes activos cuyo estado no es `CERRADO`
  3. `openAssignments` — asignaciones en estados: `PENDIENTE_DE_ASIGNACION`, `ASIGNADO`, `VISTO`, `INICIADO`, `EN_PROGRESO`
  4. `scheduledTasks` — schedules con `scheduledAt >= ahora`
  5. `recentIncidents` — últimos 5 incidentes por `reportedAt DESC` (incluye tipo, estado y nombre del reportador)
  6. `pendingAssignments` — últimas 5 asignaciones en estado `PENDIENTE_DE_ASIGNACION` o `ASIGNADO` (incluye incidente vinculado y asignados)
- Adicionalmente ejecuta una séptima consulta para `criticalIncidents`: cuenta incidentes activos cuyo `IncidentType.priority >= CRITICAL_PRIORITY_THRESHOLD (= 8)` y cuyo estado no sea `CERRADO`. Esta consulta corre dentro del mismo `Promise.all`. **Históricamente esta consulta era idéntica a `activeIncidents`; RF-215 la corrigió usando el filtro de prioridad.**

**Implementación:** `getDashboardStats()` en `src/lib/actions/dashboard.ts`

---

### RF-501 · Reporte de rendimiento FSR

**Descripción:** Mide la productividad individual de cada FSR activo en el período seleccionado.

**Reglas de negocio:**
- Filtra usuarios con `role.name = "FSR"` y `active: true`.
- Por cada FSR calcula:
  - `totalAssignments`: asignaciones donde el FSR es asignado activo en el período.
  - `completedAssignments`: asignaciones donde `status.name = "CERRADO"` **o** `finishedAt != null`.
  - `averageCompletionTime`: promedio en horas de `(finishedAt - startedAt)` entre asignaciones completadas; requiere que **ambas** fechas existan. Si no hay completadas, retorna 0.
  - `totalActivities`: suma de `assignmentActivities` activas en todas las asignaciones del período.
  - `totalTrips` y `totalKmDriven`: viajes del FSR en el período filtrados por `startedAt`.
- Resultado ordenado por `completedAssignments DESC`.
- Si no existe el rol FSR en la base de datos, retorna arreglo vacío.

**Filtros disponibles:** `startDate`, `endDate`

**Implementación:** `getFSRPerformanceData()` en `src/lib/actions/reports.ts`
**Ruta:** `/admin/reports/fsr-performance`

---

### RF-502 · Reporte de distribución de asignaciones por estado

**Descripción:** Muestra la distribución porcentual de asignaciones activas según su estado en el período.

**Reglas de negocio:**
- Agrupa asignaciones activas del período por `status.name`.
- Asignaciones sin estado registrado se agrupan bajo `"Sin Estado"`.
- El porcentaje se calcula como `round((count / total) * 100)`. Si no hay asignaciones, el denominador es 1 para evitar división por cero.

**Filtros disponibles:** `startDate`, `endDate`

**Implementación:** `getAssignmentStatusData()` en `src/lib/actions/reports.ts`
**Ruta:** `/admin/reports/assignments`

---

### RF-503 · Reporte de tendencia de incidentes

**Descripción:** Serie temporal diaria de incidentes creados y resueltos en el período.

**Reglas de negocio:**
- Agrupa por fecha de `reportedAt` (formato `YYYY-MM-DD` en UTC).
- Para cada día calcula: `count` (incidentes creados) y `resolved` (incidentes que tienen `resolvedAt != null` y fueron creados ese día).
- Resultado ordenado por fecha ASC.
- Soporta filtrado adicional por `typeId` (uno o varios tipos de incidente).

**Filtros disponibles:** `startDate`, `endDate`, `typeIds[]`

**Implementación:** `getIncidentTrendData()` en `src/lib/actions/reports.ts`
**Ruta:** `/admin/reports/incidents`

---

### RF-504 · Reporte de distribución de incidentes por tipo

**Descripción:** Distribución porcentual de incidentes activos en el período según su tipo. Incluye la prioridad de cada tipo en el resultado.

**Reglas de negocio:**
- Incidentes sin tipo se agrupan bajo `"Sin Tipo"` con prioridad por defecto 5.
- El porcentaje usa la misma lógica anti-división-por-cero que RF-502.
- Soporta filtrado por `typeIds[]` para limitar a tipos específicos.
- Cada entrada del resultado incluye `priority: number` (tomado del primer incidente del grupo).
- La UI renderiza `PriorityBadge` en la columna "Prioridad" de la tabla "Detalle por Tipo".

**Tipo de resultado:** `IncidentByTypeData` en `src/lib/actions/reports.ts` — incluye `type`, `priority`, `count`, `percentage`.

**Filtros disponibles:** `startDate`, `endDate`, `typeIds[]`

**Implementación:** `getIncidentsByTypeData()` en `src/lib/actions/reports.ts`
**Ruta:** `/admin/reports/incidents` (combinado con RF-503)

---

### RF-505 · Reporte de viajes vehiculares por día

**Descripción:** Serie temporal diaria de viajes registrados y kilómetros acumulados.

**Reglas de negocio:**
- Agrupa por fecha de `startedAt` (formato `YYYY-MM-DD` en UTC).
- Suma `kmDriven` por día; registros con `kmDriven = null` contribuyen 0.
- Resultado ordenado por fecha ASC.

**Filtros disponibles:** `startDate`, `endDate`

**Implementación:** `getVehicleTripTrendData()` en `src/lib/actions/reports.ts`
**Ruta:** `/admin/reports/vehicle-trips`

---

### RF-506 · Reporte de viajes vehiculares por FSR

**Descripción:** Ranking de FSRs por kilómetros recorridos en el período.

**Reglas de negocio:**
- Agrupa todos los viajes activos del período por FSR.
- Calcula `averageKm` como `round(totalKm / trips)`; si `trips = 0`, retorna 0.
- Resultado ordenado por `totalKm DESC`.

**Filtros disponibles:** `startDate`, `endDate`

**Implementación:** `getVehicleTripsByFSRData()` en `src/lib/actions/reports.ts`
**Ruta:** `/admin/reports/vehicle-trips` (combinado con RF-505)

---

### RF-507 · Reporte de uso de partes

**Descripción:** Consumo de inventario por parte en el período, con costo total y stock actual.

**Reglas de negocio:**
- Filtra `WorkPart` activos creados en el período.
- Por cada parte calcula:
  - `totalUsed`: suma de `quantity` en todos los WorkParts del período.
  - `totalCost`: suma de `price * quantity`, redondeada a 2 decimales.
  - `currentStock`: stock **actual** de la parte (campo `Part.stock` leído al momento de la consulta, no histórico).
- Resultado ordenado por `totalUsed DESC`.

**Filtros disponibles:** `startDate`, `endDate`

**Implementación:** `getPartsUsageData()` en `src/lib/actions/reports.ts`
**Ruta:** `/admin/reports/parts-usage`

---

### RF-508 · Resumen ejecutivo de reportes

**Descripción:** Agregado global de métricas clave para el período seleccionado, usado como cabecera en la página de reportes.

**Reglas de negocio:**
- Ejecuta 7 consultas en paralelo:
  1. `totalIncidents` — incidentes activos en el período
  2. `resolvedIncidents` — incidentes activos con `resolvedAt != null`
  3. `totalAssignments` — asignaciones activas creadas en el período
  4. `completedAssignments` — asignaciones activas con `finishedAt != null`
  5. `totalTrips` — viajes activos iniciados en el período
  6. `totalKmDriven` — suma de `kmDriven` (aggregate)
  7. `totalPartsUsed` — suma de `quantity` en WorkParts activos del período
- Calcula tasas porcentuales: `incidentResolutionRate` y `assignmentCompletionRate` (ambas con protección anti-división-por-cero).

**Implementación:** `getReportSummary()` en `src/lib/actions/reports.ts`

---

### RF-509 · Reporte de antigüedad de asignaciones (Assignment Aging)

**Descripción:** Identifica asignaciones activas **sin cerrar** (`finishedAt = null`) y las clasifica por antigüedad para detectar cuellos de botella operativos.

**Reglas de negocio:**
- Incluye únicamente asignaciones activas con `finishedAt = null` (las cerradas no envejecen).
- La edad se calcula en días completos: `floor((ahora - createdAt) / 86400000)`.
- Clasificación en 5 buckets fijos:
  - `0-7 dias`, `8-14 dias`, `15-30 dias`, `31-60 dias`, `60+ dias`
- Por cada asignación muestra: folio, título del incidente vinculado, asignados (nombres concatenados con `, `), estado, fecha de creación, edad, bucket, y fecha de la última actividad registrada.
- Asignaciones sin asignados activos se muestran como `"Sin asignar"`.
- `lastActivity` toma el `performedAt` de la actividad más reciente (1 registro, orden DESC).
- El resumen global incluye: total, distribución por bucket, edad promedio y edad máxima.
- **Sin filtro de fechas** — el reporte es siempre sobre el universo completo de asignaciones abiertas.

**Escenario crítico:**
- DADO una asignación creada hace 45 días con `finishedAt = null`
- CUANDO se ejecuta el reporte
- ENTONCES aparece en el bucket `"31-60 dias"`, incrementa `avgAge` y puede ser `oldestAssignment` si no hay asignaciones más antiguas

**Implementación:** `getAssignmentAgingData()` en `src/lib/actions/reports.ts`
**Ruta:** `/admin/reports/assignment-aging`

---

### RF-510 · Reporte de tiempo hasta "Visto" (Seen Time)

**Descripción:** Mide cuánto tiempo tarda cada FSR en acusar recibo de sus asignaciones (transición a estado VISTO).

**Reglas de negocio:**
- Filtra asignaciones activas creadas en el período.
- El tiempo de respuesta se calcula como `round((seenAt - assignedAt) / 60000)` en minutos. Requiere que **ambos** campos existan; si falta cualquiera, `timeToSeenMinutes = null` e `isSeen = false`.
- Una asignación con múltiples asignados activos genera **una fila por asignado** en el resultado.
- Asignaciones sin asignados activos se omiten del resultado (`flatMap` retorna `[]`).
- El resumen incluye: total de asignaciones, conteo de vistas, pendientes de ver, tasa de visto, promedio y **mediana** de tiempo de respuesta.
  - La mediana se calcula con sort + índice central (arreglo par: promedio de los dos centrales).
- Estadísticas por FSR: total asignadas, vistas, tiempo promedio en minutos, ordenadas por `avgTimeMinutes ASC` (mejores primero).

**Escenario crítico:**
- DADO que una asignación tiene `assignedAt` pero `seenAt = null`
- CUANDO se calcula el seen time
- ENTONCES `isSeen = false`, `timeToSeenMinutes = null`, y esta asignación cuenta en `pendingSeenCount` pero no en los promedios de tiempo

**Implementación:** `getSeenTimeData()` en `src/lib/actions/reports.ts`
**Ruta:** `/admin/reports/seen-time`

---

### RF-511 · Reporte de engagement de notificaciones

**Descripción:** Mide qué tan activamente leen sus notificaciones los FSRs en el período analizado.

**Reglas de negocio:**
- Aplica solo a usuarios con `role.name = "FSR"` y `active: true`.
- Por cada FSR calcula sobre sus notificaciones activas en el período:
  - `readCount`, `unreadCount`, `criticalUnreadCount` (prioridad >= 3)
  - `readRatePct`: porcentaje leídas; `null` si no hay notificaciones (distinguible de 0%).
  - `lastReadAt`: timestamp de la notificación leída más reciente.
  - `oldestUnreadCreatedAt` y `oldestUnreadDays`: fecha y edad en días de la notificación no leída más antigua.
- Resultado ordenado por `unreadCount DESC` (los FSRs más rezagados primero).
- El resumen global incluye: totales, `fsrsWithUnread`, `fsrsWithCriticalUnread`, `overallReadRatePct`.
- Usa `moment-timezone` con zona `America/Mexico_City` para el cálculo de `oldestUnreadDays` y los límites de fechas del período.

**Escenario crítico:**
- DADO un FSR con 10 notificaciones: 8 leídas, 2 no leídas (una con `priority = 3`)
- CUANDO se genera el reporte
- ENTONCES `readRatePct = 80`, `criticalUnreadCount = 1`, `fsrsWithCriticalUnread >= 1`

**Implementación:** `getNotificationEngagementReport()` en `src/lib/actions/reports.ts`
**Ruta:** `/admin/reports/notification-engagement`

---

### RF-512 · Reporte de cumplimiento diario de viajes (Daily Trip Compliance)

**Descripción:** Grilla de presencia diaria por FSR — indica si cada FSR registró al menos un viaje por cada día del período.

**Reglas de negocio:**
- Rango por defecto: últimos 7 días (a diferencia de los 30 días del resto de reportes).
- El eje de días se construye iterando desde `start` hasta `end` inclusive, con formato `YYYY-MM-DD` en zona `America/Mexico_City`.
- Por cada FSR se genera un mapa `byDay: Record<YYYY-MM-DD, { reported, tripCount, kmDriven }>`.
  - `reported = true` si existe al menos un viaje en ese día (usando `startedAt` en zona `America/Mexico_City`).
- `complianceRatePct = round((daysReported / totalDays) * 100)`.
- `reportedToday = true` solo si el día actual está dentro del rango Y el FSR tiene al menos un viaje registrado hoy.
- El resumen global incluye: `totalFsrs`, `fullyCompliant` (100%), `missedToday` (FSRs sin registro hoy), `averageComplianceRate`.
  - `missedToday` es 0 si el día actual no está dentro del rango analizado.

**Escenario crítico:**
- DADO un FSR que registró viajes en 5 de 7 días
- CUANDO se consulta el reporte semanal
- ENTONCES `complianceRatePct = 71` (round(5/7*100)), `daysMissed = 2`

**Implementación:** `getDailyTripComplianceReport()` en `src/lib/actions/reports.ts`
**Ruta:** `/admin/reports/daily-trip-compliance`

---

### RF-513 · Módulo de tracking — vista de seguimiento de incidentes

**Descripción:** Vista centralizada en tiempo real para que el administrador monitoree y gestione el estado de incidentes y sus asignaciones.

**Reglas de negocio:**
- Requiere permiso `tracking:read`.
- Carga hasta **500 incidentes** activos por consulta (límite fijo en `take: 500`).
- Filtros disponibles:
  - `clienteId`: filtra incidentes del cliente seleccionado
  - `typeId`: tipo de incidente
  - `statusId`: estado del incidente
  - `startDate` / `endDate`: rango de `reportedAt` (endDate se ajusta a `23:59:59.999` del día)
  - `assignedFsrId`: muestra solo incidentes con asignaciones que incluyan ese FSR
  - `folio`: búsqueda inteligente por número de folio con prefijos opcionales:
    - `INC-{n}` o `INC {n}` → busca por `incident.id`
    - `AS-{n}` o `AS {n}` → busca por `assignment.folio`
    - Solo dígitos → busca en **ambos** (incident.id OR assignment.folio)
- Por cada incidente, incluye: tipo (con `priority`), estado (con color), cliente, reportador, línea, asignados directos al incidente, y todas las asignaciones filtradas con sus asignados y estado. El campo `type.priority` se selecciona explícitamente (`priority: true`) para alimentar el `PriorityBadge` en la UI.
- Las asignaciones se ordenan por `createdAt DESC` dentro de cada incidente.
- Los incidentes se ordenan por `reportedAt DESC`.

**Escenario crítico:**
- DADO que el administrador ingresa "42" en el campo folio
- CUANDO ejecuta la búsqueda
- ENTONCES el sistema usa `OR [{ id: 42 }, { assignments: { some: { folio: 42 } } }]` para encontrar incidente #42 o cualquier incidente con asignación #42

**Implementación:** `getIncidentsForTracking()` en `src/lib/actions/tracking.ts`
**Ruta:** `/admin/tracking`

---

### RF-514 · Módulo de tracking — asignación rápida de FSR desde vista de seguimiento

**Descripción:** El administrador puede asignar un FSR a un incidente directamente desde la vista de tracking, sin navegar al formulario completo de asignaciones.

**Reglas de negocio:**
- Requiere permiso `tracking:update`.
- El FSR a asignar debe estar activo y tener `role.name = "FSR"` con un `clienteAssignment` activo vinculando al FSR con el cliente del incidente.
- Si ya existe una asignación activa para el incidente, el FSR se agrega como asignado adicional (`upsert` en `AssignmentAssignee`).
- Si no existe asignación activa, se crea una nueva con estado `ASIGNADO` y `assignedAt = new Date()`.
- Invalida cache de `/admin/tracking` con `revalidatePath`.

**Implementación:** `assignFSRToIncident()` en `src/lib/actions/tracking.ts`

---

### RF-515 · Módulo de tracking — actualización de asignados en asignación existente

**Descripción:** El administrador puede modificar la lista de FSRs asignados a una asignación directamente desde el tracking.

**Reglas de negocio:**
- Requiere permiso `tracking:update`.
- Deduplica `userIds` antes de procesar.
- Valida que todos los FSRs solicitados estén autorizados para el incidente vinculado (tabla `IncidentAssignee`). Si alguno no lo está, lanza error.
- Ejecuta la sincronización de asignados en una transacción:
  - Calcula `toRemove` (activos que no están en la nueva lista) y `toAdd` (nuevos que no estaban activos).
  - Los removidos se marcan `active: false`; los nuevos se upsert con `active: true`.
- Retorna la asignación actualizada con todos sus asignados activos.

**Implementación:** `updateAssignmentAssignees()` en `src/lib/actions/tracking.ts`

---

### RF-516 · Módulo de tracking — edición inline de incidente

**Descripción:** El administrador actualiza campos clave del incidente directamente desde la vista de tracking.

**Reglas de negocio:**
- Requiere permiso `tracking:update`.
- Campos editables: `title`, `description`, `reportedAt`, `resolvedAt` (nullable), `statusId`, `lineId` (nullable), `equipmentId` (nullable).
- `resolvedAt` se establece a `null` si se envía como null o undefined.

**Implementación:** `updateIncidentDetails()` en `src/lib/actions/tracking.ts`

---

### RF-517 · Módulo de tracking — edición inline de asignación

**Descripción:** El administrador actualiza campos de control de la asignación desde la vista de tracking.

**Reglas de negocio:**
- Requiere permiso `tracking:update`.
- Campos editables: `statusId`, `startedAt`, `finishedAt` (todos nullable).
- No aplica las validaciones de la máquina de estados (a diferencia de las acciones FSR). Es una edición administrativa directa.

**Implementación:** `updateAssignmentDetails()` en `src/lib/actions/tracking.ts`

---

## Reglas transversales aplicables

- **Zona horaria uniforme:** Reportes con grillas de días (cumplimiento diario, engagement) usan `moment-timezone` con `America/Mexico_City`. Reportes con agrupación simple por fecha usan `toISOString().split("T")[0]` (UTC). Esta inconsistencia puede producir diferencias de un día para registros creados entre 18:00 y 23:59 hora CDMX.
- **Stock no es histórico:** En el reporte de partes (RF-507), `currentStock` refleja el stock actual del catálogo, no el stock al momento del uso. Si hay consumo posterior al período analizado, el número puede ser inconsistente con el histórico.
- **Cálculo de completadas (FSR Performance):** Una asignación se considera completada si `status.name = "CERRADO"` **o** `finishedAt != null`. En principio ambas condiciones deberían ser equivalentes, pero la doble comprobación actúa como salvaguarda ante inconsistencias de datos.
- **Tracking no es GPS en tiempo real:** El módulo `/admin/tracking` es una vista filtrable de base de datos, no un mapa con actualización automática de posición GPS. La posición GPS (start/end) se captura durante las transiciones del FSR (INICIADO, CERRADO), no se actualiza de forma continua.
- **Límite de 500 incidentes en tracking:** La consulta de tracking tiene un `take: 500` fijo. No hay paginación; si se supera ese umbral, registros más antiguos pueden quedar fuera de la vista.
