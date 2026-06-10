# 02 · Clientes y jerarquía organizacional

> OpusTrack — especificación de dominio. Índice: spec/README.md

## Propósito

Modela la jerarquía de los Centros de Verificación Vehicular (CIV) en México: el Estado geográfico como nivel raíz, el Cliente como unidad de negocio principal, las Líneas de inspección dentro de cada Cliente, y los Equipos físicos dentro de cada Línea. La jerarquía determina el alcance de acceso de usuarios FSR y CLIENT, y sirve como contexto para incidentes y programaciones.

---

## Modelo de datos

### State

| Campo      | Tipo     | Notas                                         |
|------------|----------|-----------------------------------------------|
| id         | Int (PK) | Autoincrement                                 |
| name       | String   | Único. Nombre completo del estado mexicano    |
| code       | String   | Único. Código corto (ej. CDMX, PUE, JAL)     |
| active     | Boolean  | Soft delete                                   |
| clientes   | Cliente[]| Clientes registrados en este estado           |

El seed precarga los 32 estados de México.

### Cliente

| Campo          | Tipo                     | Notas                                                         |
|----------------|--------------------------|---------------------------------------------------------------|
| id             | String (CUID, PK)        | Identificador interno                                         |
| code           | String (UNIQUE)          | Código externo único del centro (ej. IZ59, CVV01)            |
| name           | String                   | Nombre comercial del centro                                   |
| companyName    | String?                  | Razón social (datos fiscales)                                 |
| rfc            | String?                  | RFC (datos fiscales)                                          |
| address        | String?                  | Dirección física                                              |
| phone          | String?                  | Teléfono de contacto                                          |
| contact        | String?                  | Nombre del contacto en el centro                              |
| email          | String?                  | Correo del contacto                                           |
| stateId        | Int (FK → State)         | Estado de México donde opera                                  |
| active         | Boolean                  | Soft delete                                                   |
| userAssignments| UserClienteAssignment[]  | Relación M:N con usuarios (tabla pivote)                     |
| lines          | Line[]                   | Líneas de inspección del centro                               |
| incidents      | Incident[]               | Incidentes registrados para este centro                       |
| scheduleClientes| ScheduleCliente[]       | Programaciones asociadas (M:N)                                |

Nota: los campos `users` (User[]) y `clienteIds` en User son relaciones legadas mantenidas por compatibilidad. El mecanismo activo es `UserClienteAssignment`.

### UserClienteAssignment

Tabla pivote que vincula usuarios (FSR o CLIENT) con Clientes.

| Campo      | Tipo              | Notas                                                   |
|------------|-------------------|---------------------------------------------------------|
| id         | String (CUID, PK) |                                                         |
| userId     | String (FK → User)|                                                         |
| clienteId  | String (FK → Cliente)|                                                     |
| isPrimary  | Boolean           | Indica el Cliente principal del usuario                 |
| active     | Boolean           | Soft delete de la asignación                            |
| @@unique   | [userId, clienteId]| Evita duplicados                                      |

### Line

| Campo       | Tipo                | Notas                                              |
|-------------|---------------------|----------------------------------------------------|
| id          | Int (PK)            | Autoincrement                                      |
| name        | String              | Nombre de la línea                                 |
| description | String?             | Descripción opcional                               |
| statusId    | Int (FK → LineStatus)| Estado operacional: ACTIVO, MANTENIMIENTO, INACTIVO |
| clienteId   | String (FK → Cliente)| Cliente dueño de la línea                         |
| active      | Boolean             | Soft delete                                        |
| equipments  | Equipment[]         | Equipos en esta línea                              |
| @@unique    | [name, clienteId]   | Nombre de línea único por Cliente                  |

### Equipment

| Campo        | Tipo                    | Notas                                            |
|--------------|-------------------------|--------------------------------------------------|
| id           | Int (PK)                | Autoincrement                                    |
| name         | String                  | Nombre del equipo                                |
| description  | String?                 | Descripción opcional                             |
| model        | String?                 | Modelo del fabricante                            |
| serialNumber | String?                 | Número de serie (indexado)                       |
| statusId     | Int (FK → EquipmentStatus)| Estado: OPERATIVO, MANTENIMIENTO, INACTIVO    |
| lineId       | Int (FK → Line)         | Línea a la que pertenece                         |
| active       | Boolean                 | Soft delete                                      |
| incidents    | Incident[]              | Incidentes vinculados a este equipo              |

---

## Requisitos funcionales

### RF-150 · CRUD de States (estados de México)

**Descripción:** El administrador puede consultar, crear, actualizar y desactivar estados de México. El seed precarga los 32 estados; el CRUD en settings permite mantenimiento posterior.

**Reglas de negocio:**
- Un estado no puede eliminarse físicamente; solo se desactiva (`active: false`).
- Solo los usuarios con permiso `states:read` / `states:create` / `states:update` / `states:delete` pueden operar este catálogo.
- Un estado desactivado queda invisible en listas pero sus Clientes asociados no se afectan automáticamente.

---

### RF-151 · Creación de Cliente

**Descripción:** El administrador crea un nuevo Centro de Verificación Vehicular con datos de identificación, datos fiscales opcionales, y asignación inicial de usuarios FSR y CLIENT.

**Reglas de negocio:**
- El campo `code` debe ser único en toda la base de datos (`@unique`).
- `stateId` es obligatorio: el Cliente debe estar asociado a un Estado activo.
- Al crear, se pueden asignar FSRs (`fsrIds`) y usuarios CLIENT (`clientIds`); la acción genera registros en `UserClienteAssignment` con `isPrimary: false` para FSR, e invoca `assignUserToCliente` (con `isPrimary: true`) para CLIENT.
- Permiso requerido: `clientes:create`.

**Escenario crítico:** Asignación inicial de FSR al crear
- DADO un administrador con permiso `clientes:create` que provee `fsrIds` en el formulario.
- CUANDO se ejecuta `createCliente`, la acción hace `upsert` en `UserClienteAssignment` por cada FSR.
- ENTONCES el FSR queda habilitado para ese Cliente con `active: true` sin afectar sus otras asignaciones.

---

### RF-152 · Actualización de Cliente

**Descripción:** El administrador puede modificar todos los campos del Cliente, incluyendo la reconciliación completa de FSRs y usuarios CLIENT asignados.

**Reglas de negocio:**
- La reconciliación de FSRs es un diff: los FSRs ya asignados que no estén en la nueva lista reciben `active: false` en `UserClienteAssignment` (soft unassign); los nuevos se crean vía upsert.
- La reconciliación de CLIENTs opera igual pero usa `assignUserToCliente`.
- Si `fsrIds` no se incluye en el payload (`undefined`), la asignación de FSRs NO se toca (solo campos escalares del Cliente).
- Permiso requerido: `clientes:update`.

---

### RF-153 · Eliminación de Cliente (soft delete)

**Descripción:** El administrador puede desactivar un Cliente (`active: false`) siempre que no tenga usuarios activos asignados.

**Reglas de negocio:**
- Antes de desactivar se verifica `UserClienteAssignment.count({ where: { clienteId, active: true } })`.
- Si existe al menos una asignación activa, la operación falla con error explícito: _"Cannot delete Cliente. N active user(s) are assigned to this center."_
- Después de la desactivación, la acción redirige a `/admin/clientes`.
- Permiso requerido: `clientes:delete`.

**Escenario crítico:** Bloqueo de borrado por usuarios activos
- DADO un Cliente con 2 FSRs activos en `UserClienteAssignment`.
- CUANDO se invoca `deleteCliente`.
- ENTONCES la operación lanza error y el Cliente mantiene `active: true`.

---

### RF-154 · Listado de Clientes con contadores

**Descripción:** La vista de listado muestra cada Cliente con contadores de líneas activas, usuarios asignados, incidentes activos, y cantidad de FSRs asignados.

**Reglas de negocio:**
- Los contadores se calculan con subconsultas `_count` y una consulta adicional por Cliente para contar FSRs activos en `UserClienteAssignment` con rol FSR.
- Solo se listan Clientes con `active: true`.
- Permiso requerido: `clientes:read`.

---

### RF-155 · Detalle de Cliente

**Descripción:** El administrador puede consultar el detalle completo de un Cliente: datos básicos, estado, usuarios asignados (con rol y estado de usuario), últimos 10 incidentes activos, y todas las líneas con sus equipos.

**Reglas de negocio:**
- Los incidentes se traen ordenados por `createdAt desc`, limitado a 10.
- Las líneas se cargan con sus equipos activos, ambas ordenadas por nombre.
- Permiso requerido: `clientes:read`.

---

### RF-156 · Gestión de Lines (líneas de inspección)

**Descripción:** El sistema permite crear, actualizar, desactivar y alternar el estado de las líneas de inspección de un Cliente.

**Reglas de negocio:**
- El nombre de la línea debe ser único por Cliente (`@@unique [name, clienteId]`).
- Al eliminar, se aplica soft delete sin validar equipos hijos (a diferencia de Cliente). La función `deleteLine` en el código no verifica equipos activos antes de desactivar.
- La función `toggleLineStatus` alterna el flag `active` (no el campo `statusId`); sirve para mostrar/ocultar líneas sin borrarlas.
- El campo `statusId` (ACTIVO / MANTENIMIENTO / INACTIVO) es independiente del flag `active`.
- Permiso requerido: `lines:create` / `lines:read` / `lines:update` / `lines:delete`.

---

### RF-157 · Gestión de Equipments (equipos físicos)

**Descripción:** El sistema permite crear, actualizar, desactivar y alternar el estado de los equipos físicos dentro de una línea.

**Reglas de negocio:**
- Un equipo pertenece a exactamente una línea (FK obligatoria).
- Al eliminar, se aplica soft delete sin verificar incidentes activos asociados.
- La función `toggleEquipmentStatus` alterna el flag `active`.
- El campo `statusId` (OPERATIVO / MANTENIMIENTO / INACTIVO) es independiente del flag `active`.
- Los incidentes vinculados al equipo (`equipmentId`) no se afectan al desactivarlo.
- Permiso requerido: `equipments:create` / `equipments:read` / `equipments:update` / `equipments:delete`.

---

### RF-158 · Asignación múltiple de Clientes a usuarios (UserClienteAssignment)

**Descripción:** Un usuario FSR puede estar asignado a varios Clientes simultáneamente. Un usuario CLIENT tiene un Cliente primario pero puede tener asignaciones adicionales. La asignación se gestiona vía `UserClienteAssignment`.

**Reglas de negocio:**
- La combinación `[userId, clienteId]` es única en la tabla (no hay duplicados activos + inactivos a nivel de PK: el `@@unique` se aplica en la clave).
- `isPrimary: true` indica el Cliente principal del usuario; para CLIENT, `getClientUsers` consulta solo las asignaciones con `isPrimary: true`.
- Las listas de FSRs y CLIENTs disponibles se obtienen con `getFSRUsers()` / `getClientUsers()`, que mapean `clienteAssignments` a `clienteIds` / `clienteId` para compatibilidad con código heredado.

---

### RF-159 · Filtrado por Cliente en vistas de datos

**Descripción:** Las vistas de incidentes y FSRs disponibles filtran automáticamente por el/los Clientes accesibles al usuario en sesión.

**Reglas de negocio:**
- Usuarios con rol ADMINISTRADOR ven todos los Clientes (sin filtro).
- Usuarios FSR y CLIENT solo ven datos de los Clientes asignados en `UserClienteAssignment`.
- El filtro se aplica vía `getClienteWhereClause(user)` en cada consulta.
- Un usuario CLIENT con `clienteId = null` (sin asignación primaria) recibe lista vacía en `getClientIncidents`.

---

## Reglas transversales aplicables

- **Soft delete global:** ningún modelo se elimina físicamente; `active: false` es el mecanismo universal.
- **Permisos en BD:** todos los checks de acceso usan `requirePermission()` contra la tabla de permisos; no hay lógica hardcodeada.
- **Caché de permisos:** 5 minutos; cambios de permisos o roles requieren re-login o invalidación manual.
- **Jerarquía estricta:** Equipment → Line → Cliente → State. No puede existir un equipo sin línea, ni una línea sin Cliente.
- **Datos fiscales opcionales:** `rfc`, `companyName` no son obligatorios en el modelo de datos; su validación de negocio depende de la UI.
