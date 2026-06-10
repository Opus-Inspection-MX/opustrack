# 01 · Autenticación y RBAC

> OpusTrack — especificación de dominio. Índice: spec/README.md

## Propósito

Documentar el sistema de autenticación por credenciales (email/contraseña) y el control de acceso basado en roles (RBAC) completamente gestionado en base de datos. Este dominio cubre el ciclo completo: login, emisión de JWT, validación de sesión, verificación de permisos y gestión de roles y usuarios.

---

## Modelo de datos

| Entidad | Propósito | Relaciones clave |
|---|---|---|
| `User` | Cuenta de acceso al sistema | → `Role` (1:1), → `UserStatus` (1:1), → `UserProfile` (1:1 opcional), → `UserClienteAssignment` (1:N) |
| `Role` | Agrupa permisos; define `defaultPath` | → `RolePermission` (1:N) |
| `Permission` | Regla de acceso atómica | resource, action, routePath (campos opcionales) |
| `RolePermission` | Tabla pivote `Role ↔ Permission` | active: Boolean (soft delete independiente) |
| `UserStatus` | Estado de la cuenta | Valores: ACTIVO, INACTIVO, SUSPENDIDO |
| `UserProfile` | Datos de contacto opcionales | telephone, secondaryTelephone, emergencyContact, jobPosition |
| `UserClienteAssignment` | Asignación multi-cliente del usuario | isPrimary: Boolean, soft delete vía `active` |

**Campos deprecados en `User`:**
- `clienteId` (String?): referencia directa al cliente primario; obsoleto, reemplazado por `UserClienteAssignment`. Se sigue escribiendo en seed y en auth por compatibilidad hacia atrás.
- `clienteIds` (String[]): array de IDs; marcado como deprecated, no se usa activamente.

---

## Requisitos funcionales

### RF-100 · Login por credenciales

**Descripción:** El sistema autentica usuarios mediante email y contraseña usando bcrypt con 10 rounds de salt.

**Reglas de negocio:**
- El usuario debe existir en la base de datos con `active: true` y `userStatus.name === "ACTIVO"`.
- La contraseña se verifica con `bcrypt.compare()` contra el hash almacenado.
- Los errores de credenciales inválidas o usuario inexistente devuelven el mismo mensaje genérico ("Invalid email or password") para no exponer si el email existe.
- Un usuario con `active: true` pero `userStatus.name !== "ACTIVO"` recibe el error "Account is not active" — mensaje diferente, lo cual sí expone que el email existe.
- La autenticación se realiza exclusivamente mediante el provider `Credentials` de NextAuth. No hay OAuth ni SSO.

**Escenario crítico:**
- DADO un usuario con email válido, contraseña correcta y status `ACTIVO`
- CUANDO envía el formulario de login
- ENTONCES se emite un JWT con 30 días de expiración que contiene: `id`, `email`, `name`, `roleId`, `roleName`, `defaultPath`, `sessionVersion`, `clienteId`

---

### RF-101 · Estrategia JWT y trade-off con Edge Runtime

**Descripción:** Las sesiones utilizan JWT (no sesiones en base de datos). El middleware de Next.js corre en Edge Runtime, que no puede instanciar Prisma directamente.

**Reglas de negocio:**
- La sesión JWT expira a los 30 días (`maxAge: 30 * 24 * 60 * 60`).
- El JWT almacena `roleName` y `defaultPath` para que el middleware pueda tomar decisiones de ruteo sin consultar la base de datos (latencia 1–5 ms).
- El middleware **no consulta la base de datos**; verifica acceso mediante la función `checkRouteAccess()` con un mapa estático `roleName → rutas permitidas` hardcodeado en `src/middleware.ts`.
- Las páginas y rutas de API que requieren chequeo fino de permisos sí consultan la base de datos a través de los helpers de `src/lib/auth/auth.ts`.
- **Trade-off documentado:** cambios de rol o permisos no toman efecto inmediato en el middleware hasta que el JWT se invalide (vía `sessionVersion`). El usuario debe re-autenticarse para que el nuevo rol se refleje en el enrutamiento del middleware.

---

### RF-102 · Validación de sesión mediante `sessionVersion`

**Descripción:** El sistema permite invalidar sesiones activas sin necesidad de listas negras de tokens, mediante un contador de versión almacenado en la base de datos.

**Reglas de negocio:**
- `User.sessionVersion` (Int, default 1) se incluye en el JWT en el momento del login.
- En cada llamada a `getAuthenticatedUser()`, el sistema consulta la base de datos y compara `user.sessionVersion` con `jwtVersion`.
- Si `jwtVersion === undefined` (JWT emitido antes de implementar esta feature), la sesión se considera válida por compatibilidad hacia atrás.
- Si los valores no coinciden, `getAuthenticatedUser()` retorna `null`, forzando re-autenticación.
- Un usuario que `active: false` en base de datos también invalida la sesión aunque el `sessionVersion` coincida (chequeado en `validateSession()`).

**Escenario crítico:**
- DADO un administrador que cambia el rol de un usuario activo
- CUANDO `updateUserRoleWithSessionInvalidation()` ejecuta `sessionVersion: { increment: 1 }` en una transacción Prisma
- ENTONCES en la siguiente request del usuario afectado, `getAuthenticatedUser()` detecta la discrepancia de versión, retorna `null`, y el usuario es redirigido a `/login`

---

### RF-103 · Acceso omnipotente del rol ADMINISTRADOR

**Descripción:** El rol `ADMINISTRADOR` tiene acceso irrestricto a todas las rutas y recursos del sistema sin requerir permisos explícitos.

**Reglas de negocio:**
- En el middleware (`src/middleware.ts:66`): si `roleName === "ADMINISTRADOR"`, se llama a `NextResponse.next()` sin verificar `checkRouteAccess()`.
- En `requireRouteAccess()` (`src/lib/auth/auth.ts:169`): si `isAdmin(user)` retorna true, se omite la verificación de ruta y se retorna el usuario directamente.
- En `roleCanAccessRoute()` (`src/lib/authz/authz.ts:171`): si `role.name === "ADMINISTRADOR"`, retorna `true` sin revisar permisos.
- `isAdmin()` compara estrictamente `user.role.name === "ADMINISTRADOR"` (comparación de string, case-sensitive).
- El seed asigna al rol ADMINISTRADOR todos los permisos del sistema (`...permissionRecords.map((p) => p.name)`).
- Los usuarios ADMINISTRADOR no están asociados a ningún Cliente (`clienteId: null` en seed).

---

### RF-104 · Rutas públicas en el middleware

**Descripción:** Un conjunto fijo de rutas se declara público y no requiere autenticación.

**Reglas de negocio:**
- Rutas públicas declaradas en `src/middleware.ts`: `/login`, `/signup`, `/logout`, `/unauthorized`.
- Prefijos públicos: `/_next`, `/favicon`, `/images`, `/api/auth`.
- Las rutas de API (`/api/`) que no son `/api/auth` pasan la verificación de JWT del middleware pero son responsables de su propia autorización mediante los helpers de `src/lib/auth/auth.ts`.
- La raíz `/` y `/dashboard` redirigen al `defaultPath` del rol del usuario autenticado.
- La config del matcher en Next.js excluye `_next`, `favicon.ico` y `api/auth` a nivel de framework antes de que el middleware evalúe rutas públicas.

---

### RF-105 · Caché de permisos (5 minutos)

**Descripción:** Los permisos y roles se cachean en memoria del servidor para evitar consultas repetitivas a la base de datos en cada request.

**Reglas de negocio:**
- La caché es un `Map<string, { data: unknown; timestamp: number }>` en `src/lib/authz/authz.ts`.
- El TTL es de 5 minutos (`5 * 60 * 1000` ms).
- Las claves de caché son: `"all-roles"`, `"all-permissions"`, `"role-{id}"`, `"role-name-{name}"`.
- `clearPermissionsCache()` vacía el `Map` completamente; debe llamarse después de modificar roles o permisos en base de datos.
- **Consecuencia:** cambios de permisos en base de datos pueden tardar hasta 5 minutos en reflejarse en requests en curso, a menos que se llame explícitamente a `clearPermissionsCache()`.
- La acción `assignPermissionsToRole()` invoca `invalidateRoleSessions()` pero **no llama a `clearPermissionsCache()`**; la propagación depende de que expire la caché o de re-login.

---

### RF-106 · Verificación de acceso a rutas (páginas)

**Descripción:** Las páginas del sistema verifican acceso mediante `requireRouteAccess()` antes de ejecutar lógica de negocio.

**Reglas de negocio:**
- `requireRouteAccess(routePath)` llama a `requireAuthPage()` que redirige a `/login` si no hay sesión.
- Si hay sesión pero el rol no tiene acceso a la ruta, redirige a `/unauthorized`.
- ADMINISTRADOR omite la verificación de ruta (ver RF-103).
- La verificación de ruta usa `roleCanAccessRoute()`, que implementa `pathname.startsWith(perm.routePath)` — es decir, un permiso sobre `/incidents` da acceso a todas las sub-rutas como `/incidents/123/edit`.
- Si el token JWT carece de `roleName` o `defaultPath`, el middleware redirige a `/login` (defensa ante JWTs malformados o de versiones anteriores).

---

### RF-107 · Helpers de autorización para API routes y Server Actions

**Descripción:** El sistema provee helpers de autorización tipados que cubren los tres patrones de verificación: por permiso nombrado, por recurso+acción, y por autenticación básica.

**Reglas de negocio:**
- `requireAuth()`: lanza `Error("Authentication required")` si no hay sesión válida.
- `requirePermission(name)`: verifica permiso por nombre exacto; lanza error si no lo tiene.
- `requireAction(resource, action)`: verifica por `resource` y `action`; útil para lógica más semántica.
- `requireRouteAccess(path)`: redirige (no lanza); solo para componentes de página.
- `withAuth(handler)`: wrapper para API routes; retorna HTTP 401 si no autenticado.
- `withPermission(name, handler)`: wrapper con verificación de permiso; retorna HTTP 403 si denegado.
- `withAction(resource, action, handler)`: wrapper con verificación de acción; retorna HTTP 403 si denegado.
- Funciones de consulta booleana (no lanzan): `canPerform()`, `canPerformAction()`, `canAccessRoute()` — útiles para renderizado condicional en Server Components.

---

### RF-108 · Gestión de roles (CRUD)

**Descripción:** Los administradores pueden crear, editar y eliminar roles con sus permisos asociados desde la interfaz.

**Reglas de negocio:**
- Requiere permiso `roles:create`, `roles:update`, `roles:delete` o `roles:read` según la operación.
- La eliminación de un rol es **soft delete** (`active: false`); no se elimina físicamente.
- No se puede eliminar un rol que tenga usuarios activos asignados; se lanza error con el conteo de usuarios afectados.
- Al actualizar permisos de un rol (`updateRole()` o `assignPermissionsToRole()`), se eliminan físicamente todos los `RolePermission` del rol y se recrean con los nuevos IDs — no hay soft delete en esta operación.
- `assignPermissionsToRole()` invoca `invalidateRoleSessions(roleId)` para forzar re-login de todos los usuarios del rol afectado.
- La revalidación de paths incluye `/admin/roles`, `/admin/roles/{id}` y `/admin/roles/{id}/permissions`.

---

### RF-109 · Gestión de usuarios (CRUD)

**Descripción:** Los administradores pueden crear, editar y eliminar usuarios del sistema.

**Reglas de negocio:**
- Requiere permiso `users:create`, `users:update`, `users:delete` o `users:read` según la operación.
- La creación de usuario siempre requiere contraseña; se hashea con bcrypt 10 rounds.
- La actualización de usuario solo actualiza la contraseña si se provee un nuevo valor (campo opcional).
- Al crear o actualizar un usuario, si se especifica `clienteId`, se gestiona mediante `UserClienteAssignment` (no se escribe directamente en `User.clienteId` desde `updateUser()`).
- Al actualizar: si el `clienteId` cambió, se remueve la asignación anterior (soft delete en `UserClienteAssignment`) y se crea la nueva como primaria.
- La eliminación de usuario es **soft delete** (`active: false`).
- Al eliminar un usuario, se llama a `invalidateUserSessions()` para invalidar su JWT inmediatamente.
- Al actualizar un usuario, si cambió el `roleId` o el `userStatusId`, se llama a `invalidateUserSessions()` automáticamente.
- `UserProfile` se crea automáticamente al crear un usuario (vía nested `create`); en actualizaciones se usa `upsert`.

---

### RF-110 · Invalidación de sesiones (administración)

**Descripción:** Los administradores pueden forzar el logout de usuarios individuales o de todos los usuarios de un rol.

**Reglas de negocio:**
- `forceLogoutUser(userId)`: requiere permiso `users:update`; incrementa `sessionVersion` del usuario.
- `forceLogoutByRole(roleId)`: requiere permiso `roles:update`; incrementa `sessionVersion` de todos los usuarios activos con ese rol.
- `forceLogoutUsers(userIds[])`: requiere permiso `users:update`; incrementa `sessionVersion` de múltiples usuarios en una sola llamada `updateMany`.
- La invalidación es **no inmediata a nivel de middleware** (JWT no está en lista negra); el usuario sigue teniendo acceso hasta su siguiente request que llame a `getAuthenticatedUser()`.
- `deactivateUserWithSessionInvalidation()`: cambia status a INACTIVO e incrementa `sessionVersion` en una transacción atómica.
- `updateUserRoleWithSessionInvalidation()`: actualiza `roleId` e incrementa `sessionVersion` en una transacción atómica.

---

### RF-111 · Asignaciones usuario-cliente (multi-cliente)

**Descripción:** Un usuario puede estar asociado a múltiples Clientes (Centros de Verificación) mediante la tabla `UserClienteAssignment`.

**Reglas de negocio:**
- Cada asignación tiene un flag `isPrimary: Boolean` que indica el Cliente principal del usuario.
- Solo puede existir un registro `isPrimary: true` por usuario; al establecer uno como primario, los demás se actualizan a `isPrimary: false`.
- La eliminación de una asignación es soft delete (`active: false` en `UserClienteAssignment`).
- `assignUserToCliente()` usa `upsert` con la clave única `[userId, clienteId]`; si la asignación ya existía (inactiva), la reactiva.
- El campo `User.clienteId` (deprecado) se mantiene como referencia de compatibilidad; la asignación canónica vive en `UserClienteAssignment`.
- Existe una función de migración `migrateClienteAssignments()` que convierte registros `User.clienteId` existentes a `UserClienteAssignment` con `isPrimary: true`. Esta función debe ejecutarse una sola vez post-deploy del nuevo esquema.
- `userHasAccessToCliente()` verifica acceso consultando por la clave compuesta `userId_clienteId` y chequeando `assignment.active`.

---

### RF-112 · Perfil propio del usuario

**Descripción:** Cada usuario puede actualizar su propio perfil y cambiar su contraseña sin requerir permisos administrativos.

**Reglas de negocio:**
- `updateMyProfile()` usa `requireAuth()` (no `requirePermission()`); cualquier usuario autenticado puede editar su propio perfil.
- Campos editables: `name`, `telephone`, `secondaryTelephone`, `emergencyContact`, `jobPosition`.
- `updateMyPassword()` requiere verificar la contraseña actual antes de aceptar la nueva.
- El cambio de contraseña **no invalida la sesión** actual ni incrementa `sessionVersion`.
- `UserProfile` se crea con `upsert`; si no existía, se crea en la primera edición de perfil.

---

## Middleware de enrutamiento — comportamiento detallado

El middleware (`src/middleware.ts`) implementa una verificación estática de rutas **distinta e independiente** del RBAC de base de datos:

```
checkRouteAccess() en middleware.ts:
  FSR   → /fsr, /incidents, /assignments, /parts, /schedules, /reports, /profile
  CLIENT → /client, /incidents, /assignments, /schedules, /profile
  GUEST  → /guest, /incidents, /assignments, /parts, /schedules, /profile
```

Este mapa es **hardcodeado** en el middleware por razones de Edge Runtime (no puede usar Prisma). Es **diferente** del RBAC de base de datos: la base de datos tiene permisos con `routePath` que `roleCanAccessRoute()` usa, pero el middleware **no** consulta eso. Son dos sistemas paralelos que deben mantenerse sincronizados manualmente.

---

## Permisos y roles

| Rol | defaultPath | Resumen de acceso |
|---|---|---|
| ADMINISTRADOR | `/admin` | Todos los permisos del sistema; bypass total en middleware y helpers |
| FSR | `/fsr` | Lectura/escritura de incidentes y asignaciones; gestión de vehículos, líneas, equipos; reportes |
| CLIENT | `/client` | Solo lectura de incidentes/asignaciones/schedules; puede crear incidentes |
| GUEST | `/guest` | Solo lectura; no puede crear nada; acceso a partes y schedules |

**Nota de permisos en seed:** Los permisos se definen en `prisma/seed.ts` con tres dimensiones opcionales independientes: `resource` + `action` (para checks semánticos en API), `routePath` (para `roleCanAccessRoute()`). Un permiso puede tener solo `routePath` (permisos `route:*`), solo `resource`/`action` (permisos de operación sin ruta), o ambos (como `incidents:read` que tiene `resource`, `action` y `routePath`).

**Usuarios de prueba en seed:** 3 por rol (admin1/2/3, fsr/fsr2/fsr3, client/client2/client3, guest/guest2/guest3), todos con contraseña `password123`. Los usuarios FSR y CLIENT están asignados a los Clientes CDMX (IZ59, IT48, TH61). ADMINISTRADOR y GUEST no tienen Cliente asignado.

---

## Reglas transversales aplicables

- **Soft delete global:** Roles, permisos, usuarios y asignaciones se desactivan con `active: false`; nunca se eliminan físicamente. Las queries de authz filtran por `active: true` tanto en roles como en `RolePermission` y `Permission`.
- **Caché de permisos:** 5 minutos de TTL en memoria del servidor. Llamar a `clearPermissionsCache()` después de mutaciones de roles/permisos para propagación inmediata (actualmente no todas las mutaciones lo hacen — ver inconsistencias).
- **Revalidación de paths:** Todas las mutaciones de usuarios y roles revalidan los paths de admin correspondientes con `revalidatePath()`.
- **Transacciones atómicas:** Las operaciones críticas (cambio de rol + invalidación de sesión, desactivación + invalidación) se ejecutan dentro de `prisma.$transaction()`.
- **Hash de contraseñas:** bcrypt con 10 salt rounds, centralizado en `src/lib/security/hash.ts`.

---

## Inconsistencias entre código y CLAUDE.md

1. **CLAUDE.md dice 4 roles, el seed crea 4 roles** — correcto, pero CLAUDE.md describe los usuarios de prueba como "1 por rol" cuando el seed actual crea **3 por rol** (12 usuarios en total, con emails `@opusinspection.com`).

2. **CLAUDE.md menciona `system@opusinspection.com` y `staff@opusinspection.com`** como credenciales de prueba. El seed actual usa `fsr@opusinspection.com` y `guest@opusinspection.com` respectivamente. Las credenciales en CLAUDE.md están desactualizadas.

3. **CLAUDE.md dice "ADMINISTRADOR no relacionado a ningún VIC"** — el código ahora usa el término `Cliente` (no VIC) para los centros de verificación. La entidad `VIC` fue renombrada a `Cliente` en algún punto de la evolución del esquema.

4. **CLAUDE.md describe el middleware como database-driven** ("Middleware loads user's role and permissions from database"). El código real hace exactamente lo contrario: usa un mapa estático hardcodeado `roleRoutes` en `checkRouteAccess()` sin consulta a base de datos. Esta es una diferencia arquitectónica importante.

5. **CLAUDE.md menciona `requirePermission`, `requireAction`, `withPermission` como helpers** — estos sí existen, pero CLAUDE.md no documenta `withAuth`, `withAction`, `assertPermission`, `assertAction`, `assertRouteAccess`, `canPerform`, `canPerformAction`, `canAccessRoute`, `requireAuthPage`, ni `getAuthenticatedUser()` que son parte de la API pública del módulo.

6. **`assignPermissionsToRole()` en `roles.ts` invoca `invalidateRoleSessions()` pero no llama a `clearPermissionsCache()`**. Esto significa que tras una actualización de permisos, la caché de 5 minutos sigue sirviendo los permisos viejos para requests en vuelo, mientras que el JWT del usuario ya fue invalidado (causará re-login). Al re-loguear, se obtienen los permisos frescos de la base de datos — por lo que en la práctica el usuario termina con los permisos correctos, pero es un comportamiento no documentado.

7. **`updateMyPassword()` no invalida la sesión**. Esto es un posible gap de seguridad: si un atacante obtiene acceso a la cuenta y el usuario legítimo cambia su contraseña, el JWT del atacante sigue siendo válido hasta que expire o se invalide manualmente.
