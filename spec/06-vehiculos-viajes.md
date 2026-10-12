# 06 · Vehículos y Viajes

> OpusTrack — especificación de dominio. Índice: spec/README.md

## Propósito

Gestionar la flota de vehículos de la empresa y registrar los viajes realizados por los FSRs. Permite rastrear el uso del vehículo, los kilómetros recorridos y vincular desplazamientos a asignaciones de trabajo.

---

## Modelo de datos

### Vehicle

| Campo           | Tipo     | Restricciones                          | Descripción                                |
|-----------------|----------|----------------------------------------|--------------------------------------------|
| `id`            | String   | PK, CUID                               | Identificador único                        |
| `make`          | String   | requerido                              | Marca (ej. "Toyota")                       |
| `model`         | String   | requerido                              | Modelo (ej. "Corolla")                     |
| `year`          | Int      | requerido                              | Año del vehículo                           |
| `licensePlate`  | String   | único, requerido                       | Placa del vehículo                         |
| `vin`           | String?  | único, opcional                        | Número de identificación vehicular (VIN)   |
| `color`         | String?  | opcional                               | Color del vehículo                         |
| `statusId`      | Int      | FK → VehicleStatus                    | Estado mostrado: `IN_USE` durante ocupación |
| `operationalStatusCode` | String | default `AVAILABLE`                | Estado operacional independiente: `AVAILABLE`, `MAINTENANCE` o `INACTIVE` |
| `odometerBaseline` | Int? | entero entre 0 y 2147483647             | Lectura base de la última corrección auditada |
| `odometerBaselineAt` | DateTime? | establecido junto con el baseline | Inicio de una nueva época física del odómetro |
| `assignedFsrId` | String?  | FK → User (rol FSR), opcional          | FSR actualmente asignado al vehículo       |
| `notes`         | String?  | opcional                               | Notas generales del vehículo               |
| `active`        | Boolean  | default true                           | Soft delete                                |

### VehicleTrip

| Campo                | Tipo      | Restricciones                     | Descripción                                     |
|----------------------|-----------|-----------------------------------|-------------------------------------------------|
| `id`                 | String    | PK, CUID                          | Identificador único                             |
| `vehicleId`          | String    | FK → Vehicle, requerido           | Vehículo utilizado                              |
| `fsrId`              | String    | FK → User, requerido              | FSR que condujo                                 |
| `assignmentId`       | String?   | FK → Assignment, opcional         | Asignación vinculada al viaje                   |
| `startOdometer`      | Int       | requerido, 0…2147483647            | Lectura odómetro de inicio (km)                 |
| `startPhotoUrl`      | String    | requerido                         | URL de la foto del odómetro de inicio           |
| `startPhotoProvider` | String    | default "vercel-blob"             | Proveedor de almacenamiento de la foto de inicio|
| `startLatitude`      | Float?    | opcional                          | Latitud GPS de inicio                           |
| `startLongitude`     | Float?    | opcional                          | Longitud GPS de inicio                          |
| `startAddress`       | String?   | opcional                          | Dirección de inicio (ingresada manualmente)     |
| `startedAt`          | DateTime  | default now()                     | Timestamp de recepción del inicio, conservado por compatibilidad |
| `startCapturedAt`    | DateTime? | captura validada; fallback a recepción si se omite | Momento de captura del inicio |
| `startExceptionReason` | String? | requerido para override de ausencia/festivo | Motivo explícito de la excepción administrativa |
| `endOdometer`        | Int?      | nullable hasta finalizar, 0…2147483647 | Lectura odómetro de fin (km)                 |
| `endPhotoUrl`        | String?   | nullable hasta finalizar          | URL de la foto del odómetro de fin              |
| `endPhotoProvider`   | String?   | nullable hasta finalizar          | Proveedor de almacenamiento de la foto de fin   |
| `endLatitude`        | Float?    | opcional                          | Latitud GPS de fin                              |
| `endLongitude`       | Float?    | opcional                          | Longitud GPS de fin                             |
| `endAddress`         | String?   | opcional                          | Dirección de fin (ingresada manualmente)        |
| `endedAt`            | DateTime? | nullable hasta finalizar          | Timestamp de recepción del fin                 |
| `endCapturedAt`      | DateTime? | no anterior al inicio efectivo    | Momento de captura del fin                      |
| `cancellationReason` | String? | requerido al cancelar              | Motivo de cancelación, separado de notas         |
| `cancelledAt`        | DateTime? | establecido al cancelar            | Momento de recepción de la cancelación           |
| `kmDriven`           | Int?      | calculado al finalizar            | Kilómetros recorridos: `endOdometer - startOdometer` |
| `notes`              | String?   | opcional                          | Notas del viaje                                 |
| `statusId`           | Int       | FK → VehicleTripStatus, default 1 | Estado del viaje                                |
| `active`             | Boolean   | default true                      | Soft delete                                     |

### VehicleStatus (catálogo)

| Nombre        | Descripción                                        |
|---------------|----------------------------------------------------|
| `AVAILABLE`   | Vehículo disponible para ser utilizado             |
| `IN_USE`      | Vehículo actualmente en uso (en un viaje activo)   |
| `MAINTENANCE` | Vehículo en mantenimiento                          |
| `INACTIVE`    | Vehículo inactivo o dado de baja                   |

### VehicleTripStatus (catálogo)

| Nombre        | Descripción                          |
|---------------|--------------------------------------|
| `EN_CURSO` | Viaje en curso                       |
| `COMPLETADO`   | Viaje finalizado con éxito           |
| `CANCELADO`   | Viaje cancelado                      |

---

## Requisitos funcionales

### RF-350 · Listar vehículos de la flota

**Descripción:** El sistema permite obtener todos los vehículos activos de la empresa, incluyendo su estado actual, FSR asignado y conteo total de viajes. No se filtra por Cliente: la flota es global (company-wide).

**Reglas de negocio:**
- Se requiere permiso `vehicles:read`.
- El resultado incluye estado (`status`), FSR asignado (`assignedFsr`) y conteo de viajes (`_count.trips`).
- Los resultados se ordenan por `licensePlate` ascendente.
- Solo se devuelven registros con `active: true`.

---

### RF-351 · Consultar detalle de un vehículo

**Descripción:** El sistema permite obtener los datos completos de un vehículo por su ID, incluyendo los últimos 10 viajes activos.

**Reglas de negocio:**
- Se requiere permiso `vehicles:read`.
- Los viajes incluidos están limitados a los 10 más recientes (`take: 10`), ordenados por `startedAt` descendente.
- Sin `vehicle-trips:manage-all`, tanto los viajes incluidos como su conteo se limitan a `fsrId = usuario.id`. El permiso `vehicles:read` no concede lectura de viajes ajenos.
- Solo se consulta un vehículo activo.
- Si el vehículo no existe, se lanza error "Vehicle not found".

---

### RF-352 · Registrar un vehículo nuevo

**Descripción:** El administrador puede registrar un nuevo vehículo en la flota con sus datos identificatorios y asignarlo opcionalmente a un FSR.

**Reglas de negocio:**
- Se requiere permiso `vehicles:create`.
- `licensePlate` debe ser único a nivel global (constraint de base de datos).
- `vin` es opcional pero, si se ingresa, debe ser único (constraint de base de datos).
- El estado se busca por `code` en el catálogo activo `VehicleStatus`; un valor inválido se rechaza sin fallback por ID.
- Los estados operacionales admitidos son `AVAILABLE`, `MAINTENANCE` e `INACTIVE`. `IN_USE` se deriva de los viajes y no puede seleccionarse manualmente.
- `assignedFsrId`, si se proporciona, debe corresponder a un usuario activo con rol FSR activo. La acción lo valida dentro de la transacción.
- Después de crear, se invalida caché de `/admin/vehicles` y `/fsr/vehicle-trips`.

---

### RF-353 · Actualizar datos de un vehículo

**Descripción:** El administrador puede modificar todos los campos de un vehículo existente, incluyendo el FSR asignado y el estado.

**Reglas de negocio:**
- Se requiere permiso `vehicles:update`.
- Mismas reglas de unicidad que en RF-352.
- Se valida catálogo activo y FSR en servidor, sin fallback por ID, como en RF-352.
- El vehículo debe estar activo. La validación y escritura se ejecutan mediante `serializableTransaction`.
- Con un viaje abierto se rechaza el estado manual `AVAILABLE`. Cambiar a `MAINTENANCE` o `INACTIVE` conserva la ocupación mostrada `IN_USE` y persiste el nuevo estado operacional para la liberación posterior.
- Después de actualizar, se invalida caché de `/admin/vehicles`, `/admin/vehicles/{id}` y `/fsr/vehicle-trips`.

---

### RF-354 · Cambiar estado de un vehículo

**Descripción:** El sistema permite actualizar únicamente el estado de un vehículo (cambio operacional rápido).

**Reglas de negocio:**
- Se requiere permiso `vehicles:update`.
- Se valida el `code` contra el catálogo activo. `IN_USE` manual se rechaza siempre; `AVAILABLE` manual se rechaza con un viaje abierto.
- `operationalStatusCode` conserva el estado administrativo; `statusId` muestra ocupación mientras exista un viaje abierto.

---

### RF-355 · Eliminar un vehículo (soft delete)

**Descripción:** El administrador puede eliminar un vehículo de la flota. La eliminación es lógica (`active: false`), nunca física.

**Reglas de negocio:**
- Se requiere permiso `vehicles:delete`.
- No se puede eliminar un vehículo si tiene viajes con estado `EN_CURSO` activos.
- Si hay viajes en curso, se devuelve rechazo con el conteo exacto de viajes activos.
- La comprobación de vehículo activo, el conteo de viajes abiertos y el soft delete comparten una transacción serializable, coordinada con el inicio de viajes.
- Después de la eliminación se redirige a `/admin/vehicles`.

---

### RF-356 · Listar FSRs disponibles para asignación

**Descripción:** El sistema provee una lista de usuarios con rol FSR activos, para usarse en el formulario de asignación de vehículo.

**Reglas de negocio:**
- Se requiere permiso `vehicles:read`.
- Solo se incluyen usuarios activos con rol FSR (`whereHasRole("FSR")`).

---

### RF-357 · Iniciar un viaje (startVehicleTrip)

**Descripción:** Un FSR inicia un viaje registrando la lectura del odómetro de inicio y una foto obligatoria del mismo. Opcionalmente puede vincularse a una asignación activa.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:create`.
- La foto del odómetro es obligatoria (campo `photo`, `File.size > 0`). Sin foto, se lanza error.
- Sin `vehicle-trips:manage-all`, el vehículo debe tener `operationalStatusCode = AVAILABLE`. Con ese permiso y un motivo explícito en `startExceptionReason` se permite usar otros estados operacionales, pero nunca un vehículo inactivo por soft delete ni ocupado.
- Solo puede existir un viaje activo `EN_CURSO` por vehículo y uno por conductor, incluso con `vehicle-trips:manage-all`. La exclusividad se verifica dentro de la transacción serializable.
- Si se vincula un `assignmentId`, la asignación debe estar activa y en un estado abierto reconocido (`PENDIENTE_DE_ASIGNACION`, `ASIGNADO`, `VISTO`, `INICIADO`, `EN_PROGRESO`), con incidente activo no terminal. Sin `manage-all`, el conductor debe ser assignee activo. El alcance de Cliente se verifica en la transacción mediante membresías activas; `manage-all` no reemplaza `scope:all-clients`.
- `startOdometer` debe ser un entero entre 0 y 2147483647 y no menor que la mayor lectura física observada en la época vigente. Se incluyen lecturas de inicio y fin de viajes completados, cancelados y soft-deleted: eliminar no borra una observación física.
- Sin corrección se considera todo el historial. Con `odometerBaselineAt`, el mínimo es el baseline más las observaciones cuya captura efectiva es igual o posterior a ese instante; las lecturas de épocas anteriores se conservan pero no imponen el mínimo nuevo. Se rechazan capturas anteriores a la corrección.
- No se permite iniciar durante vacaciones activas `APROBADA` ni festivos activos, evaluados por día CDMX de captura y de recepción. El override requiere `vehicle-trips:manage-all` y motivo explícito en `startExceptionReason`; no se reutiliza `notes` ni `cancellationReason`.
- El archivo se valida con `assertAllowedUpload`: tamaño máximo 10 MB, MIME debe estar en el allowlist (imágenes, videos, PDF, Office, texto plano).
- Al crear el viaje, el vehículo pasa automáticamente a estado `IN_USE`.
- El viaje se crea con estado `EN_CURSO`.
- Las coordenadas GPS (`startLatitude`, `startLongitude`) y la dirección (`startAddress`) son opcionales.
- El campo `fsrId` del viaje se fija al usuario autenticado (no es editable por el caller).
- `startCapturedAt` persiste la captura validada o el momento recibido si se omite. `startedAt` continúa siendo el momento de recepción.
- El upload ocurre una sola vez fuera del callback serializable. Si la transacción falla, se elimina únicamente ese upload nuevo.

**Escenario crítico — inicio de viaje:**
- DADO un FSR autenticado con permiso `vehicle-trips:create` y un vehículo en estado `AVAILABLE`
- CUANDO el FSR envía el formulario con `startOdometer = 45000` y una foto válida del odómetro
- ENTONCES se crea un `VehicleTrip` con `startOdometer = 45000`, `statusId → EN_CURSO`, `fsrId = usuario.id`, el vehículo pasa a estado `IN_USE`, y se devuelve `{ success: true, data: trip }`

---

### RF-358 · Finalizar un viaje (endVehicleTrip)

**Descripción:** Un FSR finaliza un viaje activo registrando la lectura del odómetro de fin, una foto obligatoria y opcionalmente coordenadas GPS. El sistema calcula los kilómetros recorridos.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:update`.
- La foto del odómetro de fin es obligatoria.
- El archivo se valida con `assertAllowedUpload` (mismo allowlist que RF-357).
- El viaje debe estar en estado `EN_CURSO`; si está en otro estado, se lanza error "Trip is already completed or cancelled".
- Un FSR solo puede finalizar sus propios viajes (`fsrId === user.id`). Con `vehicle-trips:manage-all` se puede finalizar cualquiera.
- `endOdometer` debe ser mayor o igual a `startOdometer`. Si es menor, se lanza error "End odometer reading cannot be less than start reading".
- `kmDriven` se calcula como `endOdometer - startOdometer` y se persiste.
- El cambio de estado usa una transición condicional `id + active: true + EN_CURSO` dentro de la transacción. Solo el ganador libera el vehículo; el perdedor elimina su upload nuevo sin modificar evidencias del ganador.
- Las comprobaciones de propietario, estado activo/abierto, odómetro y cronología se repiten dentro de la transacción; el catálogo activo `COMPLETADO` se resuelve allí.
- Al finalizar, se restaura el estado `operationalStatusCode` del vehículo, preservando `MAINTENANCE` o `INACTIVE`. No se libera mientras quede otro viaje abierto.
- El viaje pasa a estado `COMPLETADO` y se registra `endedAt = new Date()`.
- `endCapturedAt` persiste la captura validada o la recepción si se omite, y no puede ser anterior a `startCapturedAt ?? startedAt`. Tampoco se admite `endedAt < startedAt`.
- Finalizar está permitido durante vacaciones o festivos: las restricciones de disponibilidad solo bloquean nuevos inicios.

**Escenario crítico — cálculo de km y validación de odómetro:**
- DADO un viaje con `startOdometer = 45000` en estado `EN_CURSO`
- CUANDO el FSR envía `endOdometer = 45250` con foto válida
- ENTONCES el viaje se marca `COMPLETADO`, `kmDriven = 250`, `endedAt` se registra con timestamp actual, y el vehículo pasa a `AVAILABLE`

**Escenario crítico — odómetro inválido:**
- DADO un viaje con `startOdometer = 45000` en estado `EN_CURSO`
- CUANDO el FSR envía `endOdometer = 44999`
- ENTONCES el sistema lanza error "End odometer reading cannot be less than start reading" y el viaje no se modifica

---

### RF-359 · Consultar viajes propios (FSR)

**Descripción:** Un FSR puede consultar sus propios viajes con filtros opcionales por el día efectivo de captura en CDMX.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:read`.
- La consulta filtra automáticamente por `fsrId = user.id` (solo viajes propios del FSR).
- Los parámetros `startDate` y `endDate` son opcionales; sus límites inclusivos usan `mxDayRange` en CDMX. Se filtra por `startCapturedAt`; solo para viajes históricos sin captura se usa `startedAt`.
- Incluye datos del vehículo y de la asignación vinculada (si existe).
- Solo devuelve viajes con `active: true`.

---

### RF-360 · Consultar todos los viajes (administrador)

**Descripción:** El administrador puede ver todos los viajes de todos los FSRs.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:read`.
- Sin el permiso `vehicle-trips:manage-all` se lanza "Only administrators can view all trips".
- Incluye datos del vehículo, del FSR y de la asignación vinculada.

---

### RF-361 · Consultar detalle de un viaje

**Descripción:** Permite obtener el detalle completo de un viaje por su ID.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:read`.
- Un FSR solo accede a sus propios viajes. Con `vehicle-trips:manage-all` se accede a cualquiera.
- Si el viaje no existe, se lanza error "Trip not found".
- Si el FSR intenta acceder a un viaje ajeno, se lanza error "Access denied: You can only view your own trips".

---

### RF-362 · Actualizar notas y direcciones de un viaje

**Descripción:** Permite editar las notas y direcciones de inicio/fin de un viaje sin modificar los datos de odómetro ni el estado.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:update`.
- Solo se pueden actualizar `notes`, `startAddress` y `endAddress`.
- Un FSR solo actualiza sus propios viajes (salvo `vehicle-trips:manage-all`).

---

### RF-363 · Eliminar un viaje (soft delete)

**Descripción:** Elimina lógicamente un viaje sin destruir sus evidencias físicas.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:delete`.
- Un FSR solo elimina sus propios viajes (salvo `vehicle-trips:manage-all`).
- Se realiza soft delete (`active: false`).
- Las fotos, lecturas y capturas de inicio/fin se conservan por retención. No se eliminan del proveedor al hacer soft delete.
- Si el viaje está `EN_CURSO`, se exige un motivo explícito y se delega a la misma transición condicional de cancelación de RF-366 antes de desactivarlo, dentro de una sola transacción.
- Eliminar un viaje terminado no modifica el estado del vehículo.
- Después de eliminar, se redirige a `/fsr/vehicle-trips`.

---

### RF-364 · Obtener vehículos disponibles

**Descripción:** Devuelve los vehículos activos cuyo estado es `AVAILABLE`, para presentar en el formulario de inicio de viaje.

**Reglas de negocio:**
- Se requiere permiso `vehicles:read`.
- Solo devuelve vehículos con `active: true`, `operationalStatusCode = AVAILABLE` y ningún viaje activo `EN_CURSO`, independientemente del display histórico.

---

### RF-365 · Vincular viaje a asignación propia

**Descripción:** Al iniciar un viaje, el FSR puede vincularlo a una de sus asignaciones activas.

**Reglas de negocio:**
- Se requiere autenticación (`requireAuth`).
- Solo se muestran asignaciones activas donde el usuario es assignee activo, dentro de su alcance de Cliente y con uno de los estados abiertos reconocidos en RF-357.
- Se devuelven las últimas 20 asignaciones, ordenadas por `createdAt` descendente.
- El vínculo se establece en `VehicleTrip.assignmentId` al crear el viaje.

---

### RF-261 · Borradores offline y reintento para inicio/fin de viaje

**Descripción:** El mecanismo de borrador-y-reintento de RF-260 se extiende a `startVehicleTrip` y `endVehicleTrip`: lecturas de odómetro, fixes GPS, timestamps y fotos capturados en campo persisten localmente ante fallo/sin conexión y se envían al reconectar bajo las mismas reglas de idempotencia, frescura y sin-fusión.

**Reglas de negocio:**
- Todas las reglas de RF-260 aplican sin cambios (evidencia congelada del momento, llaves de idempotencia en `ActionIdempotency`, ventana de 24h con rechazo en español, guardas sin cambios, borradores conservados ante conflicto, almacenamiento con tope, disparadores de envío).
- Las fotos del odómetro se guardan como blobs `File` locales en memoria y se envían como `File` en el payload reintentado (sin persistencia base64 — la regla RF-259 se extiende aquí). Si la cuota del dispositivo lo fuerza, la persistencia de la foto PUEDE degradarse primero — pero escalares + GPS + odómetro SIEMPRE persisten, y la degradación es visible al operador (muestra miniatura o pide re-adjuntar), nunca silenciosa. Tras recargar la página el blob en memoria se pierde y la UI pide re-adjuntar la foto antes de reintentar.
- La monotonicidad del odómetro y todas las guardas existentes de viaje corren al momento del envío contra el estado vivo del servidor.
- Las capturas de inicio y fin se persisten separadamente de las fechas de recepción. La ventana existente de 24 horas y tolerancia de reloj aplican antes de cualquier escritura.
- Los formularios online-first generan `idempotencyKey` y `capturedAt` antes del primer envío y conservan esa identidad al reintentar; no generan una operación nueva ante una respuesta perdida. `startCapturedAt` y `endCapturedAt` conservan observaciones distintas de `startedAt` y `endedAt`.
- El recibo vincula actor, acción y destino solicitado: vehículo para `startVehicleTrip`, viaje para `endVehicleTrip`. Su `targetId` identifica el viaje confirmado. Una llave coincidente devuelve el viaje vivo tras verificar autorización y acceso actuales, sin repetir transición, carga de fotos ni notificaciones; otro actor/acción/destino produce conflicto. Los recibos antiguos sin vínculo fallan cerrado y requieren revisión manual.
- El replay confirmado no exige que el viaje conserve su estado previo al inicio/fin; no permite sustituir evidencia ni fusionar payloads. Para operaciones no confirmadas se verifican ocupación, estado operacional, odómetro y época física contra el estado vivo en la misma transacción que la escritura.

---

### RF-366 · Cancelar un viaje abierto

**Acción:** `cancelVehicleTrip(id, reason)`.

- Requiere `vehicle-trips:update`; solo viajes propios salvo `vehicle-trips:manage-all`.
- Exige motivo no vacío y viaje activo `EN_CURSO`. La transición condicional guarda `CANCELADO`, `cancellationReason`, `cancelledAt` y el actor de actualización.
- Conserva fotos, lecturas, GPS, capturas y notas. No fabrica una lectura final ni kilómetros recorridos.
- La liberación del vehículo ocurre únicamente después de ganar la transición y restaura su estado operacional. Cancelación, liberación y soft delete cuando corresponda son atómicos.

### RF-367 · Corregir el odómetro de forma auditada

**Acción:** `correctVehicleOdometer(vehicleId, reading, reason)`.

- Requiere ambos permisos: `vehicles:update` y `vehicle-trips:manage-all`.
- Exige vehículo activo sin viajes abiertos, lectura entera entre 0 y 2147483647 y motivo no vacío.
- Establece `odometerBaseline`, `odometerBaselineAt` y `updatedById`. Permite una lectura menor, incluso cero, para reemplazo de odómetro.
- Agrega un registro inmutable `BusinessCorrection` con `entityType = Vehicle`, `entityId`, `actorId`, motivo y snapshots `before`/`after` del baseline y su timestamp. El baseline y la auditoría comparten la misma transacción serializable; un error de auditoría revierte la corrección.
- La corrección inicia una nueva época física; nunca reescribe lecturas ni fotos históricas. La UI administrativa puede consumir la acción sin editar directamente los campos de baseline.

**Escenario crítico — reemplazo del odómetro:**
- DADO un vehículo sin viajes abiertos cuyo historial alcanza 95000 km.
- CUANDO un administrador autorizado corrige a 0 km por reemplazo del odómetro.
- ENTONCES se guarda la corrección auditada y un viaje nuevo puede iniciar en 0 km; una observación posterior de 70 km obliga a que el siguiente inicio sea al menos 70 km.

---

## Estados y transiciones

### Vehículo (VehicleStatus)

```
Estado operacional: AVAILABLE ↔ MAINTENANCE ↔ INACTIVE
Estado mostrado:    operacional ──(iniciar viaje)──► IN_USE
                    IN_USE ──(finalizar/cancelar)──► operacional vigente
```

| Transición automática        | Acción que la dispara            |
|------------------------------|----------------------------------|
| `AVAILABLE → IN_USE`         | `startVehicleTrip`               |
| `IN_USE → estado operacional vigente` | `endVehicleTrip` / `cancelVehicleTrip` / eliminación de viaje abierto |

### Viaje (VehicleTripStatus)

```
EN_CURSO ──(endVehicleTrip)──► COMPLETADO
EN_CURSO ──(cancelVehicleTrip con motivo)──► CANCELADO
```

Las transiciones terminales requieren viaje activo `EN_CURSO` y solo se aplican una vez. No existe edición genérica del estado del viaje.

---

## Reglas transversales aplicables

- **Soft delete universal**: ningún registro se elimina físicamente. `active: false` en Vehicle y VehicleTrip.
- **Fotos obligatorias**: tanto inicio como fin de viaje requieren foto del odómetro. La validación ocurre en el servidor antes de cualquier operación de base de datos.
- **Allowlist de archivos**: las fotos se validan con `assertAllowedUpload` (máx. 10 MB; MIME permitidos: imágenes, videos, PDF, Office, texto plano). Esto es una validación server-side de defensa en profundidad, independiente del cliente.
- **Proveedor de almacenamiento**: cada foto conserva su proveedor (`startPhotoProvider`, `endPhotoProvider`). Los uploads de operaciones perdedoras se limpian; las evidencias persistidas se retienen incluso tras cancelación o soft delete.
- **GPS opcional**: las coordenadas GPS y dirección son opcionales en inicio y fin. Su ausencia no bloquea ninguna operación.
- **Permisos de flota por permiso, no por rol**: `vehicles:create/update/delete` no están en el seed del FSR (solo `vehicles:read` + `vehicle-trips`).
- **Aislamiento de datos por FSR**: un FSR nunca lee, modifica ni elimina viajes de otro FSR. La única excepción es `vehicle-trips:manage-all`.
