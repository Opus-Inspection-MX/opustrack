# 🟡 MODERADO: Documentar Limitaciones del Middleware

## Problema
El middleware tiene permisos hardcodeados debido a limitaciones del Edge Runtime, pero esto no está claramente documentado. Puede causar confusión sobre cuándo los permisos de BD aplican.

**Severity**: 🟡 Media (Documentación)
**Esfuerzo**: 🟢 Bajo (30 minutos)
**Impacto**: Claridad para desarrolladores

## Contexto

Del análisis:
```
PROBLEMA CRÍTICO: Middleware No Usa Sistema de Base de Datos
- Los permisos en BD NO afectan el middleware
- Cambios en permisos requieren cambiar código
- Middleware usa roleRoutes hardcodeados
```

Esto es **por diseño** debido a que Edge Runtime no puede usar Prisma directamente, pero necesita estar documentado explícitamente.

## Solución

### 1. Documentar en el Código del Middleware

**Archivo**: `src/middleware.ts`

Agregar comentario extenso al inicio:

```typescript
/**
 * Middleware de Autenticación y Autorización
 *
 * ARQUITECTURA DE SEGURIDAD EN CAPAS:
 * ==========================================
 *
 * Este middleware es la PRIMERA capa de seguridad, pero NO la única.
 * OpusTrack implementa un sistema de seguridad de 3 capas:
 *
 * 1. MIDDLEWARE (aquí) - Edge Runtime
 *    - Verifica autenticación (JWT válido)
 *    - Bloquea acceso obvio no autorizado
 *    - Redirige a defaultPath según rol
 *    - ⚠️  PERMISOS HARDCODEADOS (no consulta BD)
 *
 * 2. PAGES - Server Components
 *    - requireRouteAccess() consulta BD
 *    - Verifica permisos granulares
 *    - Carga permisos frescos del usuario
 *
 * 3. API ROUTES / SERVER ACTIONS
 *    - requirePermission() consulta BD
 *    - withPermission() wrapper
 *    - Validación final antes de mutaciones
 *
 * ¿POR QUÉ PERMISOS HARDCODEADOS EN MIDDLEWARE?
 * =============================================
 *
 * Edge Runtime NO puede usar Prisma directamente:
 * - Sin Node.js APIs (fs, crypto nativo)
 * - Sin acceso a base de datos
 * - Optimizado para latencia ultra-baja (1-5ms)
 *
 * Alternativas consideradas:
 * - ❌ Prisma Edge: No funciona con PostgreSQL
 * - ❌ API call a /auth/check: Añade 50-200ms latencia
 * - ✅ JWT + hardcoded routes: Trade-off aceptado
 *
 * TRADE-OFFS DE ESTE ENFOQUE:
 * ============================
 *
 * PROS:
 * - Latencia mínima: 1-5ms vs 50-200ms
 * - No DB queries en cada request
 * - Bloqueo rápido de acceso no autorizado
 *
 * CONS:
 * - Cambios de permisos requieren re-login
 * - roleRoutes debe mantenerse manualmente
 * - Inconsistencia potencial con BD
 *
 * IMPORTANTE: AUTORIZACIÓN REAL EN PAGES/APIS
 * ============================================
 *
 * Este middleware solo hace validación GRUESA.
 * La autorización REAL sucede en:
 *
 * - Pages: await requireRouteAccess("/route")
 * - APIs: await requirePermission("resource:action")
 * - Actions: await withPermission("resource:action", handler)
 *
 * ¿Cuando un usuario NO tiene permiso realmente?
 * - Cuando requireRouteAccess() lo rechaza (consulta BD)
 * - Cuando requirePermission() lo rechaza (consulta BD)
 *
 * El middleware solo acelera el "happy path" y bloquea
 * acceso obviamente no autorizado.
 *
 * ACTUALIZAR roleRoutes:
 * ======================
 *
 * Al agregar nuevos roles o rutas, actualizar:
 * 1. Este archivo (roleRoutes)
 * 2. Base de datos (Permissions + RolePermissions)
 * 3. CLAUDE.md (documentación)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * HARDCODED ROLE ROUTES
 *
 * ⚠️  WARNING: These must match database permissions!
 *
 * To update:
 * 1. Add route to this object
 * 2. Add Permission to database with routePath
 * 3. Assign Permission to Role in RolePermission table
 */
const roleRoutes: Record<string, string[]> = {
  ADMINISTRADOR: [], // Empty = all routes (checked explicitly)
  FSR: ["/fsr", "/incidents", "/work-orders", "/parts", "/schedules"],
  CLIENT: ["/client", "/incidents", "/work-orders", "/schedules"],
  GUEST: ["/guest", "/incidents", "/work-orders", "/parts"],
};

// ... resto del código del middleware
```

### 2. Actualizar CLAUDE.md

**Archivo**: `CLAUDE.md`

Expandir la sección "JWT + Edge Runtime Architecture":

```markdown
### JWT + Edge Runtime Architecture

**Critical Design Decision**: Middleware runs on Edge Runtime (cannot use Prisma directly).

**The Pattern**:
1. **JWT Token** stores: `id`, `email`, `name`, `roleId`, `defaultPath`, `roleName`
2. **Middleware** uses JWT data for fast route protection (1-5ms, no DB calls)
3. **API Routes/Pages** still query database for fine-grained permission checks
4. **Trade-off**: Role/permission changes require user to re-login to take effect

**Why This Matters**:
- Middleware runs on EVERY request - must be fast
- Direct Prisma calls in middleware would be 25x slower (50-200ms vs 1-5ms)
- Hybrid approach: JWT for routing speed, DB for permission accuracy

**Security Implications**:

This creates a **3-layer security model**:

| Layer | Technology | Speed | Granularity | DB Query |
|-------|------------|-------|-------------|----------|
| 1. Middleware | Edge Runtime | 1-5ms | Coarse (role-based) | ❌ No |
| 2. Pages | Server Components | 10-50ms | Fine (permission-based) | ✅ Yes |
| 3. APIs/Actions | Node.js Runtime | 10-50ms | Fine (permission-based) | ✅ Yes |

**Important**: Middleware is NOT the final authority on permissions. It's a fast
pre-filter that blocks obvious unauthorized access. Real authorization happens at
the page/API level with database queries.

**Updating Permissions**:

When you change role permissions in the database:
1. Middleware will NOT reflect changes until user re-logs in (JWT limitation)
2. Pages/APIs WILL reflect changes immediately (they query DB)
3. Users may pass middleware but fail at page level (this is expected)

To force permission updates:
- Option 1: User must logout and login again
- Option 2: Implement session invalidation (see todos/10-longterm-session-invalidation.md)
- Option 3: Set shorter JWT expiration (trade-off: more frequent logins)

**Why Not Database-Driven Middleware?**

We considered:
- ❌ **Prisma in Edge**: Doesn't work with PostgreSQL
- ❌ **API call to DB**: Adds 50-200ms latency per request
- ❌ **Prisma Data Proxy**: Additional cost and complexity
- ✅ **JWT + hardcoded routes**: Best performance/security balance

**Developer Workflow**:

When adding new routes or roles:
1. Update `src/middleware.ts` roleRoutes object
2. Add Permission to database with matching routePath
3. Assign Permission to appropriate Roles
4. Update this documentation
5. Test with re-login (JWT refresh)
```

### 3. Agregar Comentarios en Auth Helpers

**Archivo**: `src/lib/auth/auth.ts`

```typescript
/**
 * Server-side authentication and authorization helpers
 *
 * These functions query the database for fresh permissions,
 * unlike the middleware which uses JWT caching.
 *
 * Use these in:
 * - Server Components (pages)
 * - API Routes
 * - Server Actions
 *
 * DO NOT rely on middleware for authorization - it only
 * does fast pre-filtering. Always use these functions
 * for actual permission checks.
 */

/**
 * Require user to have access to a specific route
 *
 * This queries the database for user's current permissions,
 * NOT the JWT token. This ensures permission changes take
 * effect immediately without re-login.
 *
 * @throws Redirects to /unauthorized if no access
 */
export async function requireRouteAccess(routePath: string) {
  // Implementation...
}
```

### 4. Crear Diagrama de Arquitectura (Opcional)

**Archivo**: `docs/architecture-security-layers.md`

```markdown
# Arquitectura de Seguridad en Capas

## Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────┐
│                         USER REQUEST                         │
│                     (Every HTTP Request)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: MIDDLEWARE                       │
│                     (Edge Runtime)                           │
├─────────────────────────────────────────────────────────────┤
│  ✓ JWT Token Valid?                                         │
│  ✓ User Authenticated?                                      │
│  ✓ Role in roleRoutes[role]?  ⚠️ HARDCODED                │
│                                                              │
│  Speed: 1-5ms                                               │
│  DB Queries: 0                                              │
│  Decision: COARSE (role-based only)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                    ALLOW
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              LAYER 2: PAGE / SERVER COMPONENT                │
│                  (Node.js Runtime)                           │
├─────────────────────────────────────────────────────────────┤
│  requireRouteAccess("/admin/incidents")                     │
│    ├─ Query DB for user's role                             │
│    ├─ Load role's permissions                               │
│    ├─ Check route:admin/incidents permission                │
│    └─ Allow or Redirect to /unauthorized                    │
│                                                              │
│  Speed: 10-50ms                                             │
│  DB Queries: 1-2                                            │
│  Decision: FINE-GRAINED (permission-based)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                    RENDER
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         LAYER 3: API ROUTE / SERVER ACTION                   │
│                  (Node.js Runtime)                           │
├─────────────────────────────────────────────────────────────┤
│  await requirePermission("incidents:delete")                 │
│    ├─ Query DB for user's role                             │
│    ├─ Load role's permissions                               │
│    ├─ Check incidents:delete permission                     │
│    └─ Allow or Throw 403 Forbidden                          │
│                                                              │
│  Speed: 10-50ms                                             │
│  DB Queries: 1-2                                            │
│  Decision: FINE-GRAINED (permission-based)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                  EXECUTE DB
                  MUTATION
                       │
                       ▼
                   SUCCESS
```

## Casos de Uso

### Caso 1: Usuario Autorizado (Happy Path)
1. FSR visita `/incidents`
2. Middleware: ✅ JWT válido, "FSR" tiene "/incidents" en roleRoutes
3. Page: ✅ DB confirma user tiene "route:incidents" permission
4. Render: ✅ Página se renderiza

### Caso 2: Middleware Bloquea (Fast Reject)
1. CLIENT visita `/admin`
2. Middleware: ❌ "CLIENT" NO tiene "/admin" en roleRoutes
3. Redirect: → `/unauthorized`
4. Page: (nunca se ejecuta)

### Caso 3: Middleware Permite pero Page Rechaza
1. FSR visita `/admin`
2. Middleware: ✅ JWT válido, pero role no verificado aún
3. Page: ❌ DB dice FSR NO tiene "route:admin"
4. Redirect: → `/unauthorized`

**Este caso es ESPERADO**: Middleware hace pre-filter, Page hace decisión real.

### Caso 4: Permisos Cambian en BD
1. Admin revoca "incidents:create" de rol FSR en BD
2. FSR ya logged in (JWT no cambió)
3. FSR visita `/incidents`: ✅ Middleware permite (JWT aún dice "FSR")
4. FSR intenta crear incident: ❌ Server Action rechaza (BD dice "sin permiso")

**Solución**: FSR debe hacer logout/login para actualizar JWT
```

## Checklist de Completado

- [ ] Agregar comentario extenso en `src/middleware.ts`
- [ ] Expandir sección "JWT + Edge Runtime" en CLAUDE.md
- [ ] Agregar comentarios en `src/lib/auth/auth.ts`
- [ ] Crear diagrama de arquitectura (opcional)
- [ ] Actualizar README.md con link a arquitectura
- [ ] Revisar que roleRoutes coincide con BD
- [ ] Documentar proceso de actualización de permisos

## Criterio de Éxito

✅ Middleware tiene comentario claro explicando limitaciones
✅ CLAUDE.md documenta trade-offs de arquitectura
✅ Desarrolladores entienden 3 capas de seguridad
✅ Queda claro que middleware NO es autoridad final
✅ Proceso de actualización de permisos documentado
