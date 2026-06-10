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
| `statusId`      | Int      | FK → VehicleStatus, default 1          | Estado actual del vehículo                 |
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
| `startOdometer`      | Int       | requerido                         | Lectura odómetro de inicio (km)                 |
| `startPhotoUrl`      | String    | requerido                         | URL de la foto del odómetro de inicio           |
| `startPhotoProvider` | String    | default "vercel-blob"             | Proveedor de almacenamiento de la foto de inicio|
| `startLatitude`      | Float?    | opcional                          | Latitud GPS de inicio                           |
| `startLongitude`     | Float?    | opcional                          | Longitud GPS de inicio                          |
| `startAddress`       | String?   | opcional                          | Dirección de inicio (ingresada manualmente)     |
| `startedAt`          | DateTime  | default now()                     | Timestamp de inicio del viaje                   |
| `endOdometer`        | Int?      | nullable hasta finalizar          | Lectura odómetro de fin (km)                    |
| `endPhotoUrl`        | String?   | nullable hasta finalizar          | URL de la foto del odómetro de fin              |
| `endPhotoProvider`   | String?   | nullable hasta finalizar          | Proveedor de almacenamiento de la foto de fin   |
| `endLatitude`        | Float?    | opcional                          | Latitud GPS de fin                              |
| `endLongitude`       | Float?    | opcional                          | Longitud GPS de fin                             |
| `endAddress`         | String?   | opcional                          | Dirección de fin (ingresada manualmente)        |
| `endedAt`            | DateTime? | nullable hasta finalizar          | Timestamp de fin del viaje                      |
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
| `IN_PROGRESS` | Viaje en curso                       |
| `COMPLETED`   | Viaje finalizado con éxito           |
| `CANCELLED`   | Viaje cancelado                      |

---

## Requisitos funcionales

### RF-350 · Listar vehículos de la flota

**Descripción:** El sistema permite obtener todos los vehículos activos de la empresa, incluyendo su estado actual, FSR asignado y conteo total de viajes. No se filtra por VIC: la flota es global (company-wide).

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
- Si el vehículo no existe, se lanza error "Vehicle not found".

---

### RF-352 · Registrar un vehículo nuevo

**Descripción:** El administrador puede registrar un nuevo vehículo en la flota con sus datos identificatorios y asignarlo opcionalmente a un FSR.

**Reglas de negocio:**
- Se requiere permiso `vehicles:create`.
- `licensePlate` debe ser único a nivel global (constraint de base de datos).
- `vin` es opcional pero, si se ingresa, debe ser único (constraint de base de datos).
- El estado se busca por nombre en la tabla `VehicleStatus`; si no se encuentra, se usa `statusId = 1` como fallback.
- `assignedFsrId` debe corresponder a un usuario con rol FSR, aunque la validación es responsabilidad del llamador (no se valida en la acción).
- Después de crear, se invalida caché de `/admin/vehicles` y `/fsr/vehicles`.

---

### RF-353 · Actualizar datos de un vehículo

**Descripción:** El administrador puede modificar todos los campos de un vehículo existente, incluyendo el FSR asignado y el estado.

**Reglas de negocio:**
- Se requiere permiso `vehicles:update`.
- Mismas reglas de unicidad que en RF-352.
- El estado se resuelve por nombre, con fallback a `statusId = 1` si no se encuentra.
- Después de actualizar, se invalida caché de `/admin/vehicles`, `/admin/vehicles/{id}` y `/fsr/vehicles`.

---

### RF-354 · Cambiar estado de un vehículo

**Descripción:** El sistema permite actualizar únicamente el estado de un vehículo (cambio operacional rápido).

**Reglas de negocio:**
- Se requiere permiso `vehicles:update`.
- Si el nombre del estado no existe en `VehicleStatus`, se lanza error "Invalid status".

---

### RF-355 · Eliminar un vehículo (soft delete)

**Descripción:** El administrador puede eliminar un vehículo de la flota. La eliminación es lógica (`active: false`), nunca física.

**Reglas de negocio:**
- Se requiere permiso `vehicles:delete`.
- No se puede eliminar un vehículo si tiene viajes con estado `IN_PROGRESS` activos.
- Si hay viajes en curso, se lanza error con el conteo exacto de viajes activos.
- Después de la eliminación se redirige a `/admin/vehicles`.

---

### RF-356 · Listar FSRs disponibles para asignación

**Descripción:** El sistema provee una lista de usuarios con rol FSR activos, para usarse en el formulario de asignación de vehículo.

**Reglas de negocio:**
- Se requiere permiso `vehicles:read`.
- Solo se incluyen usuarios con `roleId` correspondiente al rol de nombre "FSR" y `active: true`.

---

### RF-357 · Iniciar un viaje (startVehicleTrip)

**Descripción:** Un FSR inicia un viaje registrando la lectura del odómetro de inicio y una foto obligatoria del mismo. Opcionalmente puede vincularse a una asignación activa.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:create`.
- La foto del odómetro es obligatoria (campo `photo`, `File.size > 0`). Sin foto, se lanza error.
- Si el caller no es ADMINISTRADOR, el vehículo debe tener estado `AVAILABLE`. Los administradores pueden iniciar un viaje en vehículos con cualquier estado.
- Si se vincula un `assignmentId`, el FSR debe ser assignee activo de esa asignación (salvo si es ADMINISTRADOR).
- El archivo se valida con `assertAllowedUpload`: tamaño máximo 10 MB, MIME debe estar en el allowlist (imágenes, videos, PDF, Office, texto plano).
- Al crear el viaje, el vehículo pasa automáticamente a estado `IN_USE`.
- El viaje se crea con estado `IN_PROGRESS`.
- Las coordenadas GPS (`startLatitude`, `startLongitude`) y la dirección (`startAddress`) son opcionales.
- El campo `fsrId` del viaje se fija al usuario autenticado (no es editable por el caller).

**Escenario crítico — inicio de viaje:**
- DADO un FSR autenticado con permiso `vehicle-trips:create` y un vehículo en estado `AVAILABLE`
- CUANDO el FSR envía el formulario con `startOdometer = 45000` y una foto válida del odómetro
- ENTONCES se crea un `VehicleTrip` con `startOdometer = 45000`, `statusId → IN_PROGRESS`, `fsrId = usuario.id`, el vehículo pasa a estado `IN_USE`, y se devuelve `{ success: true, data: trip }`

---

### RF-358 · Finalizar un viaje (endVehicleTrip)

**Descripción:** Un FSR finaliza un viaje activo registrando la lectura del odómetro de fin, una foto obligatoria y opcionalmente coordenadas GPS. El sistema calcula los kilómetros recorridos.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:update`.
- La foto del odómetro de fin es obligatoria.
- El archivo se valida con `assertAllowedUpload` (mismo allowlist que RF-357).
- El viaje debe estar en estado `IN_PROGRESS`; si está en otro estado, se lanza error "Trip is already completed or cancelled".
- Un FSR solo puede finalizar sus propios viajes (`fsrId === user.id`). El ADMINISTRADOR puede finalizar cualquiera.
- `endOdometer` debe ser mayor o igual a `startOdometer`. Si es menor, se lanza error "End odometer reading cannot be less than start reading".
- `kmDriven` se calcula como `endOdometer - startOdometer` y se persiste.
- Al finalizar, el vehículo vuelve automáticamente a estado `AVAILABLE`.
- El viaje pasa a estado `COMPLETED` y se registra `endedAt = new Date()`.

**Escenario crítico — cálculo de km y validación de odómetro:**
- DADO un viaje con `startOdometer = 45000` en estado `IN_PROGRESS`
- CUANDO el FSR envía `endOdometer = 45250` con foto válida
- ENTONCES el viaje se marca `COMPLETED`, `kmDriven = 250`, `endedAt` se registra con timestamp actual, y el vehículo pasa a `AVAILABLE`

**Escenario crítico — odómetro inválido:**
- DADO un viaje con `startOdometer = 45000` en estado `IN_PROGRESS`
- CUANDO el FSR envía `endOdometer = 44999`
- ENTONCES el sistema lanza error "End odometer reading cannot be less than start reading" y el viaje no se modifica

---

### RF-359 · Consultar viajes propios (FSR)

**Descripción:** Un FSR puede consultar sus propios viajes con filtros opcionales de rango de fechas por `startedAt`.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:read`.
- La consulta filtra automáticamente por `fsrId = user.id` (solo viajes propios del FSR).
- Los parámetros `startDate` y `endDate` son opcionales; si se proveen, filtran por `startedAt ≥ startDate 00:00:00` y `startedAt ≤ endDate 23:59:59.999`.
- Incluye datos del vehículo y de la asignación vinculada (si existe).
- Solo devuelve viajes con `active: true`.

---

### RF-360 · Consultar todos los viajes (administrador)

**Descripción:** El administrador puede ver todos los viajes de todos los FSRs.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:read`.
- Si el usuario no tiene rol `ADMINISTRADOR`, se lanza error "Only administrators can view all trips" aunque tenga el permiso.
- Incluye datos del vehículo, del FSR y de la asignación vinculada.

---

### RF-361 · Consultar detalle de un viaje

**Descripción:** Permite obtener el detalle completo de un viaje por su ID.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:read`.
- Un FSR solo puede acceder a sus propios viajes. El ADMINISTRADOR puede acceder a cualquiera.
- Si el viaje no existe, se lanza error "Trip not found".
- Si el FSR intenta acceder a un viaje ajeno, se lanza error "Access denied: You can only view your own trips".

---

### RF-362 · Actualizar notas y direcciones de un viaje

**Descripción:** Permite editar las notas y direcciones de inicio/fin de un viaje sin modificar los datos de odómetro ni el estado.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:update`.
- Solo se pueden actualizar `notes`, `startAddress` y `endAddress`.
- Un FSR solo puede actualizar sus propios viajes (excepto ADMINISTRADOR).

---

### RF-363 · Eliminar un viaje (soft delete)

**Descripción:** Elimina lógicamente un viaje y sus fotos del almacenamiento.

**Reglas de negocio:**
- Se requiere permiso `vehicle-trips:delete`.
- Un FSR solo puede eliminar sus propios viajes (excepto ADMINISTRADOR).
- Se realiza soft delete (`active: false`).
- Las fotos de inicio y fin se eliminan del proveedor de almacenamiento configurado. Si la eliminación falla, el proceso continúa (error no bloquea el soft delete).
- Si el viaje estaba en estado `IN_PROGRESS` al momento de eliminarse, el vehículo vuelve automáticamente a estado `AVAILABLE`.
- Después de eliminar, se redirige a `/fsr/vehicle-trips`.

---

### RF-364 · Obtener vehículos disponibles

**Descripción:** Devuelve los vehículos activos cuyo estado es `AVAILABLE`, para presentar en el formulario de inicio de viaje.

**Reglas de negocio:**
- Se requiere permiso `vehicles:read`.
- Solo devuelve vehículos con `active: true` y `status.name = "AVAILABLE"`.

---

### RF-365 · Vincular viaje a asignación propia

**Descripción:** Al iniciar un viaje, el FSR puede vincularlo a una de sus asignaciones activas.

**Reglas de negocio:**
- Se requiere autenticación (`requireAuth`).
- Solo se muestran asignaciones donde el usuario es assignee activo, con estado distinto de `COMPLETED`, `CANCELLED`, `COMPLETADA` o `CANCELADA`, y `active: true`.
- Se devuelven las últimas 20 asignaciones, ordenadas por `createdAt` descendente.
- El vínculo se establece en `VehicleTrip.assignmentId` al crear el viaje.

---

## Estados y transiciones

### Vehículo (VehicleStatus)

```
AVAILABLE ──(iniciar viaje)──► IN_USE ──(finalizar/eliminar viaje)──► AVAILABLE
    │
    ├──(cambio manual)──► MAINTENANCE
    └──(cambio manual)──► INACTIVE
```

| Transición automática        | Acción que la dispara            |
|------------------------------|----------------------------------|
| `AVAILABLE → IN_USE`         | `startVehicleTrip`               |
| `IN_USE → AVAILABLE`         | `endVehicleTrip` / `deleteVehicleTrip` (si viaje era IN_PROGRESS) |

### Viaje (VehicleTripStatus)

```
IN_PROGRESS ──(endVehicleTrip)──► COMPLETED
IN_PROGRESS ──(cancelación manual de estado)──► CANCELLED
```

> `CANCELLED` no tiene acción server dedicada en el código actual; solo existe como estado de catálogo.

---

## Reglas transversales aplicables

- **Soft delete universal**: ningún registro se elimina físicamente. `active: false` en Vehicle y VehicleTrip.
- **Fotos obligatorias**: tanto inicio como fin de viaje requieren foto del odómetro. La validación ocurre en el servidor antes de cualquier operación de base de datos.
- **Allowlist de archivos**: las fotos se validan con `assertAllowedUpload` (máx. 10 MB; MIME permitidos: imágenes, videos, PDF, Office, texto plano). Esto es una validación server-side de defensa en profundidad, independiente del cliente.
- **Proveedor de almacenamiento**: la foto almacena el proveedor utilizado (`startPhotoProvider`, `endPhotoProvider`), permitiendo eliminación correcta si el proveedor cambia entre ambas operaciones.
- **GPS opcional**: las coordenadas GPS y dirección son opcionales en inicio y fin. Su ausencia no bloquea ninguna operación.
- **Permisos de flota solo para ADMINISTRADOR**: `vehicles:create`, `vehicles:update` y `vehicles:delete` no se asignan al rol FSR en el seed. El FSR solo tiene `vehicles:read` y los permisos completos de `vehicle-trips`.
- **Aislamiento de datos por FSR**: un FSR nunca puede leer, modificar ni eliminar viajes de otro FSR. La única excepción es el rol ADMINISTRADOR.
