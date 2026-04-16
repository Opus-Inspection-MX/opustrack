# 🟢 LARGO PLAZO: Implementar Invalidación de Sesiones

## Problema
Los cambios de permisos requieren que el usuario haga logout/login para que el JWT se actualice. No hay forma de invalidar sesiones activas.

**Severity**: 🟡 Media (UX + Seguridad)
**Esfuerzo**: 🔴 Alto (8-10 horas)
**Impacto**: Seguridad, UX para cambios de permisos

## Contexto

Del análisis:
```
"Role changes require re-login to take effect (JWT-based routing)"
```

**Problemas**:
1. Admin cambia permisos → Usuario debe logout/login
2. Usuario comprometido → No se puede forzar logout
3. Testing frustrante (cambios no inmediatos)

## Solución

### Opción A: Session Database (Recomendada)

Migrar de JWT-only a database sessions con NextAuth.

**Ventajas**:
- Invalidación instantánea
- Control completo sobre sesiones
- Fácil revocar acceso

**Desventajas**:
- Query DB en cada request (latencia)
- Más carga en DB
- Requiere migración

### Opción B: JWT Version Number

Agregar versión en JWT y BD, invalidar incrementando versión.

**Ventajas**:
- Mantiene performance de JWT
- Invalidación selectiva

**Desventajas**:
- Requiere cambio en schema
- Latencia en middleware (query DB)

### Opción C: Redis Blocklist

Mantener lista de JWTs revocados en Redis.

**Ventajas**:
- Performance alta
- No cambia NextAuth config

**Desventajas**:
- Requiere Redis
- Complejidad adicional
- Cost en producción

## Implementación (Opción A - Database Sessions)

### 1. Actualizar Schema

NextAuth con database sessions requiere estos modelos:

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Campos custom para tracking
  ipAddress    String?
  userAgent    String?
  lastActive   DateTime @default(now())

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model User {
  // Agregar relaciones
  accounts Account[]
  sessions Session[]
}
```

```bash
npx prisma migrate dev --name add_nextauth_tables
```

### 2. Actualizar NextAuth Config

```typescript
// src/app/api/auth/[...nextauth]/route.ts

import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/database/prisma.singleton";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // Cambiar a database strategy
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 días
    updateAge: 24 * 60 * 60, // Actualizar cada 24h
  },

  callbacks: {
    async session({ session, user }) {
      // Cargar permisos frescos en cada request
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          }
        }
      });

      if (dbUser) {
        session.user = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          roleId: dbUser.roleId,
          role: dbUser.role,
          // Permisos actualizados
        };
      }

      return session;
    }
  }
};
```

### 3. Middleware con Database Sessions

```typescript
// src/middleware.ts

export async function middleware(request: NextRequest) {
  const session = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Con database strategy, session siempre está actualizada
  // No necesita hardcoded roleRoutes

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Actualizar lastActive
  await prisma.session.update({
    where: { sessionToken: session.sessionToken },
    data: { lastActive: new Date() }
  });

  // Verificar permisos desde BD (ya cargados en session)
  const hasAccess = await checkRouteAccess(
    session.user.role,
    request.nextUrl.pathname
  );

  if (!hasAccess) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}
```

### 4. API para Invalidar Sesiones

```typescript
// src/app/api/admin/sessions/route.ts

export async function DELETE(req: Request) {
  const user = await requirePermission("users:manage");

  const { userId, sessionId } = await req.json();

  if (sessionId) {
    // Invalidar sesión específica
    await prisma.session.delete({
      where: { id: sessionId }
    });

    logger.security(
      SecurityEventType.SESSION_REVOKED,
      `Session ${sessionId} revoked`,
      { adminId: user.id, targetUserId: userId }
    );
  } else if (userId) {
    // Invalidar todas las sesiones del usuario
    await prisma.session.deleteMany({
      where: { userId }
    });

    logger.security(
      SecurityEventType.ALL_SESSIONS_REVOKED,
      `All sessions revoked for user ${userId}`,
      { adminId: user.id, targetUserId: userId }
    );
  }

  return NextResponse.json({ success: true });
}

// Listar sesiones activas
export async function GET(req: Request) {
  const user = await requirePermission("users:manage");

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  const sessions = await prisma.session.findMany({
    where: userId ? { userId } : {},
    include: { user: { select: { email: true, name: true } } },
    orderBy: { lastActive: 'desc' }
  });

  return NextResponse.json(sessions);
}
```

### 5. UI de Gestión de Sesiones

```typescript
// src/app/admin/users/[id]/sessions/page.tsx

export default async function UserSessionsPage({ params }) {
  const { id } = await params;
  await requireRouteAccess("/admin/users");

  const sessions = await prisma.session.findMany({
    where: { userId: id },
    orderBy: { lastActive: 'desc' }
  });

  return (
    <div>
      <h1>Active Sessions</h1>

      <SessionsList sessions={sessions} userId={id} />
    </div>
  );
}

// src/components/admin/SessionsList.tsx
"use client";

export function SessionsList({ sessions, userId }) {
  const revokeSession = async (sessionId: string) => {
    await fetch('/api/admin/sessions', {
      method: 'DELETE',
      body: JSON.stringify({ sessionId })
    });

    router.refresh();
  };

  const revokeAll = async () => {
    await fetch('/api/admin/sessions', {
      method: 'DELETE',
      body: JSON.stringify({ userId })
    });

    router.refresh();
  };

  return (
    <div>
      <Button onClick={revokeAll} variant="destructive">
        Revoke All Sessions
      </Button>

      {sessions.map(session => (
        <Card key={session.id}>
          <p>Last Active: {format(session.lastActive, 'PPpp')}</p>
          <p>IP: {session.ipAddress}</p>
          <p>User Agent: {session.userAgent}</p>

          <Button onClick={() => revokeSession(session.id)}>
            Revoke
          </Button>
        </Card>
      ))}
    </div>
  );
}
```

### 6. Auto-invalidación en Cambio de Permisos

```typescript
// src/lib/actions/roles.ts

export async function updateRolePermissions(
  roleId: number,
  permissionIds: number[]
) {
  const user = await requirePermission("roles:update");

  await prisma.$transaction(async (tx) => {
    // Eliminar permisos antiguos
    await tx.rolePermission.deleteMany({
      where: { roleId }
    });

    // Agregar permisos nuevos
    await tx.rolePermission.createMany({
      data: permissionIds.map(permissionId => ({
        roleId,
        permissionId
      }))
    });

    // Invalidar sesiones de usuarios con este rol
    const usersWithRole = await tx.user.findMany({
      where: { roleId },
      select: { id: true }
    });

    await tx.session.deleteMany({
      where: {
        userId: { in: usersWithRole.map(u => u.id) }
      }
    });
  });

  logger.security(
    SecurityEventType.ROLE_CHANGED,
    `Role ${roleId} permissions updated, sessions invalidated`,
    { adminId: user.id, roleId }
  );

  revalidatePath('/admin/roles');
  return { success: true };
}
```

## Implementación (Opción B - JWT Version)

### 1. Agregar Session Version al Schema

```prisma
model User {
  sessionVersion Int @default(1)  // Incrementar para invalidar
}
```

### 2. Incluir en JWT

```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.sessionVersion = user.sessionVersion;
    }
    return token;
  }
}
```

### 3. Validar en Middleware

```typescript
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verificar versión
  const user = await prisma.user.findUnique({
    where: { id: token.sub },
    select: { sessionVersion: true }
  });

  if (!user || user.sessionVersion !== token.sessionVersion) {
    // JWT desactualizado, forzar logout
    return NextResponse.redirect(new URL("/login?expired=true", request.url));
  }

  return NextResponse.next();
}
```

### 4. Invalidar Incrementando Versión

```typescript
export async function invalidateUserSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      sessionVersion: { increment: 1 }
    }
  });
}
```

## Performance Impact

### Database Sessions
- Query adicional por request: ~5-20ms
- Mitigación: Connection pooling, índices optimizados
- Caching: Session data puede cachearse con TTL corto

### JWT Version
- Query en middleware: ~5-20ms
- Solo cuando se detecta cambio de permisos
- Cache de versión en Redis: ~1-2ms

## Checklist de Completado

- [ ] Decidir entre Database Sessions o JWT Version
- [ ] Actualizar schema Prisma
- [ ] Migrar tablas
- [ ] Actualizar NextAuth config
- [ ] Modificar middleware para validar sesiones
- [ ] Crear API de gestión de sesiones
- [ ] Crear UI de sesiones activas
- [ ] Auto-invalidar en cambio de permisos
- [ ] Testing de invalidación
- [ ] Documentar en CLAUDE.md

## Criterio de Éxito

✅ Cambios de permisos aplican inmediatamente
✅ Admin puede revocar sesiones individuales
✅ Usuarios comprometidos pueden ser desconectados
✅ Performance aceptable (<50ms overhead)
✅ UI muestra sesiones activas
