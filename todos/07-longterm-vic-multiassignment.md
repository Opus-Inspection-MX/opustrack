# 🟢 LARGO PLAZO: Refactor VIC Multi-assignment

## Problema
El schema tiene `vicId` (deprecated) y `vicIds` (array no usado), causando confusión. Los FSR deberían poder asignarse a múltiples VICs pero la funcionalidad no está implementada.

**Severity**: 🟡 Media (Confusión + Limitación Futura)
**Esfuerzo**: 🟡 Medio (4-6 horas)
**Impacto**: Soporte para FSR multi-VIC

## Estado Actual

```prisma
model User {
  vicId    String?     // Deprecated - kept for backward compatibility
  vicIds   String[]    @default([])  // Array of VIC IDs for FSR assignments
  vic      VIC?        @relation(fields: [vicId], references: [id])
}
```

## Problema
- `vicId` singular sigue usándose en todo el código
- `vicIds` array está definido pero nunca se usa
- FSR solo puede estar en un VIC a la vez
- Relación es 1:N cuando debería ser M:N

## Solución Propuesta

### Opción A: Junction Table (Recomendada)

**Mejor para**: Consultas complejas, meta-datos por asignación

```prisma
model UserVicAssignment {
  id        String  @id @default(cuid())
  userId    String
  vicId     String
  isPrimary Boolean @default(false) // VIC principal del usuario
  active    Boolean @default(true)

  user      User    @relation(fields: [userId], references: [id])
  vic       VIC     @relation(fields: [vicId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, vicId])
  @@index([userId])
  @@index([vicId])
}

model User {
  // Eliminar vicId y vicIds
  vicAssignments UserVicAssignment[]

  // Helper: VIC primario
  primaryVicId String?
}
```

**Ventajas**:
- Más flexible (agregar meta-datos futuro)
- Mejor para consultas complejas
- Estándar de normalización

**Desventajas**:
- Más complejo de implementar
- Requiere joins adicionales

### Opción B: Mantener Array (Más Simple)

**Mejor para**: Implementación rápida, menos joins

```prisma
model User {
  // Eliminar vicId singular
  vicIds        String[]  @default([])
  primaryVicId  String?

  // No hay relación directa, se resuelve programáticamente
}
```

**Ventajas**:
- Implementación más simple
- Menos joins en queries
- PostgreSQL soporta arrays nativamente

**Desventajas**:
- Difícil agregar meta-datos
- Queries más complejas con arrays

## Implementación (Opción A - Junction Table)

### 1. Actualizar Schema

```bash
npx prisma migrate dev --name user_vic_multi_assignment
```

### 2. Migración de Datos

```typescript
// prisma/migrations/XXXX_migrate_vic_assignments.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateVicAssignments() {
  const users = await prisma.user.findMany({
    where: { vicId: { not: null } }
  });

  for (const user of users) {
    await prisma.userVicAssignment.create({
      data: {
        userId: user.id,
        vicId: user.vicId!,
        isPrimary: true, // VIC actual se vuelve primario
      }
    });
  }

  console.log(`Migrated ${users.length} user VIC assignments`);
}

migrateVicAssignments();
```

### 3. Helper Functions

```typescript
// src/lib/utils/vic-assignments.ts

/**
 * Get all VICs assigned to a user
 */
export async function getUserVics(userId: string) {
  const assignments = await prisma.userVicAssignment.findMany({
    where: { userId, active: true },
    include: { vic: true }
  });

  return assignments.map(a => a.vic);
}

/**
 * Get user's primary VIC
 */
export async function getPrimaryVic(userId: string) {
  const assignment = await prisma.userVicAssignment.findFirst({
    where: { userId, isPrimary: true, active: true },
    include: { vic: true }
  });

  return assignment?.vic;
}

/**
 * Check if user has access to VIC
 */
export async function userHasAccessToVic(userId: string, vicId: string) {
  const assignment = await prisma.userVicAssignment.findUnique({
    where: {
      userId_vicId: { userId, vicId }
    }
  });

  return assignment?.active ?? false;
}

/**
 * Assign user to VIC
 */
export async function assignUserToVic(
  userId: string,
  vicId: string,
  isPrimary = false
) {
  return await prisma.userVicAssignment.create({
    data: { userId, vicId, isPrimary }
  });
}
```

### 4. Actualizar Filtros VIC

```typescript
// src/lib/auth/filters.ts

export async function getVicWhereClause(user: UserWithPermissions) {
  if (isAdmin(user)) return {};

  // Nuevo: Obtener todos los VICs asignados
  const vicIds = await getUserVicIds(user.id);

  if (vicIds.length === 0) {
    return { vicId: null };
  }

  // Si tiene múltiples VICs, usar IN
  if (vicIds.length === 1) {
    return { vicId: vicIds[0] };
  }

  return { vicId: { in: vicIds } };
}

async function getUserVicIds(userId: string): Promise<string[]> {
  const assignments = await prisma.userVicAssignment.findMany({
    where: { userId, active: true },
    select: { vicId: true }
  });

  return assignments.map(a => a.vicId);
}
```

### 5. UI para Gestión de Asignaciones

```typescript
// src/app/admin/users/[id]/vics/page.tsx

export default async function UserVicAssignmentsPage({ params }) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      vicAssignments: {
        where: { active: true },
        include: { vic: true }
      }
    }
  });

  const allVics = await prisma.vIC.findMany({
    where: { active: true }
  });

  return (
    <div>
      <h1>VIC Assignments for {user.name}</h1>

      <VicAssignmentList
        assignments={user.vicAssignments}
        availableVics={allVics}
        userId={user.id}
      />
    </div>
  );
}
```

## Testing

### Test Cases
1. **Single VIC**: User asignado a 1 VIC (backward compatible)
2. **Multiple VICs**: FSR asignado a 3 VICs, ve datos de todos
3. **Primary VIC**: User tiene primary VIC para defaultPath
4. **VIC Removal**: Remover asignación, user pierde acceso
5. **Admin**: Admin sigue viendo todos los VICs

## Checklist de Completado

- [ ] Decidir entre Junction Table o Array
- [ ] Actualizar schema Prisma
- [ ] Crear migración
- [ ] Crear script de migración de datos
- [ ] Implementar helper functions
- [ ] Actualizar filtros VIC para multi-VIC
- [ ] Crear UI de gestión de asignaciones
- [ ] Actualizar seed para incluir ejemplos multi-VIC
- [ ] Testing manual con FSR multi-VIC
- [ ] Documentar en CLAUDE.md

## Criterio de Éxito

✅ Users pueden asignarse a múltiples VICs
✅ FSR con múltiples VICs ve datos de todos
✅ Primary VIC determina defaultPath
✅ Backward compatible con data existente
✅ UI permite gestionar asignaciones
