# 01 · Autenticación y RBAC

> OpusTrack — especificación de dominio. Índice: spec/README.md

## Propósito

Documentar la autenticación por credenciales (email/contraseña) y el control de
acceso basado en roles completamente gestionado en base de datos: login, JWT,
validación de sesión, permisos multi-rol y gestión de roles y usuarios.

---

## Modelo de datos

| Entidad | Propósito | Relaciones clave |
|---|---|---|
| `User` | Cuenta de acceso | → `UserRole` (1:N, **un usuario tiene MUCHOS roles**), → `UserStatus`, → `UserProfile` (1:1 opcional), → `UserClienteAssignment` (1:N) |
| `Role` | Agrupa permisos; define `defaultPath` e `isSuperuser` | → `RolePermission` (1:N) |
| `Permission` | Regla atómica: `resource` + `action` opcionales, `routePath` opcional | → `RolePermission` (1:N) |
| `RolePermission` | Pivote `Role ↔ Permission` | `active` (soft delete independiente) |
| `UserRole` | Pivote `User ↔ Role` | `active` (soft delete independiente) |
| `UserStatus` | Estado de la cuenta | Valores: ACTIVO, INACTIVO, SUSPENDIDO |
| `UserProfile` | Contacto opcional | telephone, secondaryTelephone, emergencyContact, jobPosition |
| `UserClienteAssignment` | Alcance multi-Cliente | `isPrimary`, soft delete vía `active` |

**No existe `roleId` en `User`** — es deliberado. Un usuario puede administrar
vacaciones, administrar operación y seguir siendo FSR. El código nunca compara
nombres de rol: usa `whereHasRole()` / `whereHasPermission()`
(`src/lib/authz/user-queries.ts`).

**Campos deprecados en `User` (solo lectura por compatibilidad):**
- `clienteId`: escalar del Cliente primario; la fuente canónica es
  `UserClienteAssignment`. Se sigue escribiendo al asignar primario.
- `clienteIds`: array marcado deprecated, no se usa.

---

## Requisitos funcionales

### RF-100 · Login por credenciales

**Descripción:** Autenticación con email + contraseña (bcrypt) vía provider
`Credentials` de NextAuth. Sin OAuth ni SSO.

**Reglas de negocio:**
- El usuario debe existir con `active: true` y `userStatus.name === "ACTIVO"`.
- Credenciales inválidas o usuario inexistente devuelven el mismo mensaje
  genérico, para no exponer si el email existe.
- El JWT expira a los 30 días y contiene: `roleNames[]`, `isSuperuser`,
  `defaultPath`, `routePaths[]`, `exactRoutePaths[]`, `sessionVersion`,
  `clienteId`.

---

### RF-101 · JWT + Edge Runtime (sin DB en el middleware)

**Descripción:** El middleware (`src/middleware.ts`) corre en Edge Runtime y no
puede instanciar Prisma: enruta solo con lo que viaja en el JWT.

**Reglas de negocio:**
- Las rutas permitidas del rol (`Permission.routePath`) se embeben en el token
  al iniciar sesión y se evalúan con `canAccessRoute()`
  (`src/lib/authz/route-access.ts`); el mismo matcher usa el servidor.
- Un token emitido antes de que existiera `routePaths` fuerza re-login en vez
  de degradar a permisivo.
- Las rutas `/api/*` (salvo `/api/auth/*`) pasan el middleware con sesión
  válida y aplican su propia autorización (`withPermission` / `requirePermission`).
- Matcher: todo salvo `_next`, `favicon.ico` y `api/auth`. Rutas públicas:
  `/login`, `/signup`, `/logout`, `/unauthorized`. La raíz `/` redirige al
  `defaultPath` del usuario.

---

### RF-102 · Invalidación de sesión con `sessionVersion`

**Descripción:** Contador en `User` que invalida JWTs sin listas negras.

**Reglas de negocio:**
- `getAuthenticatedUser()` compara `user.sessionVersion` con el `jwtVersion`
  del token en cada request; si difieren, retorna `null` (re-login).
- Cambiar contraseña, rol, estado o eliminar un usuario incrementa
  `sessionVersion` en la misma transacción.
- Un usuario con `active: false` o estado distinto de ACTIVO invalida la
  sesión aunque la versión coincida.

---

### RF-103 · Superusuario ROOT e isAdmin por permiso

**Descripción:** El bypass total y el alcance de datos son dos cosas distintas.

**Reglas de negocio:**
- `isSuperuser` (solo ROOT) omite **todo** check de ruta y permiso.
  Reemplazó al hardcode `role.name === "ADMINISTRADOR"`, que significaba
  cuatro cosas a la vez (bypass, alcance, override de propiedad y audiencia).
- Ver datos de **todos** los Clientes es el permiso `scope:all-clientes`
  (`SCOPE_ALL_CLIENTES`), no el superusuario. Un admin de operación lo tiene
  sin poder otorgar roles; un admin de vacaciones no lo tiene.
- `isAdmin()` (`src/lib/auth/filters.ts`) = tener ese permiso (o ser ROOT).

---

### RF-104 · Scoping multi-Cliente async

**Descripción:** Una sola vía para el alcance por Cliente.

**Reglas de negocio:**
- `getReportScope(user)` resuelve los Clientes (asignaciones + fallback al
  escalar legacy) y `*ScopeWhere()` genera el fragmento Prisma por entidad.
- Fail closed: sin Clientes asignados, el filtro no matchea nada.
- No existen variantes sincrónicas de un solo Cliente; todo es async.
- `scopeIncludesCliente()` cubre callbacks sincrónicos (`.some`, `.filter`).

---

### RF-105 · Caché de permisos (5 minutos)

**Descripción:** `Map` en memoria en `src/lib/authz/authz.ts`, TTL 5 minutos.

**Reglas de negocio:**
- Claves: `"all-roles"`, `"all-permissions"`, `"role-{id}"`, `"role-name-{name}"`.
- `clearPermissionsCache()` se llama tras mutar roles/permisos; sin ella, un
  request en vuelo puede servir permisos viejos hasta 5 minutos.

---

### RF-106 · Verificación de acceso en páginas

**Descripción:** `requireRouteAccess(path)` antes de la lógica de negocio.

**Reglas de negocio:**
- Sin sesión → redirect a `/login`; sin acceso → redirect a `/unauthorized`.
- El superusuario omite la verificación.
- El match es por prefijo salvo rutas marcadas exactas (`exactRoutePaths`).

---

### RF-107 · Helpers para API routes y Server Actions

**Descripción:** Tres patrones: permiso nombrado, recurso+acción, autenticación.

**Reglas de negocio:**
- `requireAuth()` / `requirePermission(name)` / `requireAction(res, act)`:
  lanzan si no hay acceso (las fallas de permiso deben seguir siendo
  excepciones para que el redirect ocurra).
- `requireRouteAccess(path)`: redirige; solo páginas.
- `withPermission(name, handler)`: wrapper de API route (403 si denegado).
- Booleanas sin throw para UI condicional: `canPerform()`,
  `canPerformAction()`, `getMyAccessibleRoutes()`.

---

### RF-108 · Gestión de roles (CRUD)

**Descripción:** CRUD de roles con permisos desde `/admin/roles`
(`roles:create/update/delete/read`).

**Reglas de negocio:**
- Soft delete (`active: false`); no se elimina un rol con usuarios activos.
- Crear usuario exige contraseña y al menos un rol; crear otorga acceso, así
  que solo ROOT puede hacerlo (`assertCanManageRoles`).
- Actualizar permisos reemplaza los `RolePermission` e invalida sesiones del
  rol (`invalidateRoleSessions`).
- La asignación fina vive en `/admin/roles/[id]/permissions` (no hay UI
  standalone de permisos).

---

### RF-109 · Gestión de usuarios (CRUD)

**Descripción:** CRUD desde `/admin/users` (`users:*`); detalle real en
`/admin/users/[id]`.

**Reglas de negocio:**
- Contraseña con bcrypt (10 rounds); en update solo se toca si viene valor.
- El Cliente se gestiona vía `UserClienteAssignment` (primario incluido);
  cambiarlo mueve la asignación anterior a inactiva.
- `UserProfile` se crea con el usuario (nested `create`) y se actualiza con
  `upsert`.
- Eliminar es soft delete + `invalidateUserSessions()`.

---

### RF-110 · Perfil propio y contraseña

**Descripción:** `/profile` con `getMyProfile` / `updateMyProfile` /
`updateMyPassword` (solo `requireAuth`, sin permisos admin).

**Reglas de negocio:**
- Campos: `name`, `telephone`, `secondaryTelephone`, `emergencyContact`,
  `jobPosition`.
- Cambiar contraseña exige la actual e incrementa `sessionVersion` (invalida
  las demás sesiones).

---

### RF-111 · Seed y cuentas de prueba

**Descripción:** `scripts/db-init.ts` migra siempre y siembra solo si la base
está vacía: usa `initial_load/seed.ts` (gitignored, datos reales) o el
template tracked `initial_load/seed.example.ts`. No existe `prisma/seed.ts`.

**Reglas de negocio:**
- Roles: ROOT (`/admin`, `isSuperuser`), ADMIN_OPERACION
  (`/admin/tracking`), ADMIN_VACACIONES (`/admin/vacations`), FSR (`/fsr`),
  EMPLEADO (`/vacations`), CLIENT (`/client`), GUEST (`/guest`).
- Usuarios de prueba `{rol}@opusinspection.com` / `password123`, tres por rol
  principal. FSR/CLIENT/EMPLEADO con asignaciones a Clientes; ROOT sin Cliente.

---

## Reglas transversales aplicables

- **Soft delete global:** roles, permisos, pivotes y usuarios se desactivan;
  las queries de authz filtran `active: true` en cada nivel.
- **Revalidación:** mutaciones revalidan `/admin/roles`, `/admin/users` y
  rutas de detalle.
- **Transacciones:** cambio de rol/estado + invalidación de sesión en el mismo
  `prisma.$transaction`.
- **Hash:** bcrypt 10 rounds en `src/lib/security/hash.ts`.

---

## Cobertura de pruebas

- `src/lib/auth/filters.test.ts` — alcance async y `assertClienteAccessAsync`
  como `BusinessRuleError` en español.
- `src/lib/auth/report-scope.test.ts` — fragmentos por entidad, fail closed y
  `scopeIncludesCliente`.
- `src/lib/authz/route-access.test.ts` — matcher de prefijos/exactas y bypass
  de superusuario.
- `e2e/rbac-roles.spec.ts` — cada rol aterriza en su módulo y no alcanza los
  demás; suite `flows` para programacion/tracking.

---

## RF rango registrado

RF-100 – RF-149: Autenticación y RBAC (este dominio).
