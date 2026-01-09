# 🟢 LARGO PLAZO: Separar ScheduleStatus de IncidentStatus

## Problema
Los Schedules reutilizan `IncidentStatus` que es semánticamente incorrecto. Los estados de un schedule son diferentes a los de un incident.

**Severity**: 🟡 Media (Confusión Semántica)
**Esfuerzo**: 🟢 Bajo (1-2 horas)
**Impacto**: Claridad del modelo

## Estado Actual

```prisma
model Schedule {
  statusId  Int?
  status    IncidentStatus? @relation(fields: [statusId], references: [id])
}
```

**Problema**:
- Schedule usa estados de Incident (ABIERTO, EN_PROGRESO, CERRADO)
- Semánticamente incorrecto
- No permite estados específicos de Schedule

## Solución

### 1. Crear ScheduleStatus

```prisma
model ScheduleStatus {
  id          Int        @id @default(autoincrement())
  name        String     @unique
  description String?
  color       String
  active      Boolean    @default(true)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  schedules   Schedule[]
}

model Schedule {
  statusId  Int?
  status    ScheduleStatus? @relation(fields: [statusId], references: [id])
  // Cambio: IncidentStatus → ScheduleStatus
}
```

### 2. Estados de Schedule Propuestos

```typescript
const SCHEDULE_STATUSES = [
  {
    name: "BORRADOR",
    description: "Schedule en edición, no confirmado",
    color: "#94a3b8" // gray
  },
  {
    name: "CONFIRMADO",
    description: "Schedule confirmado, listo para ejecutar",
    color: "#3b82f6" // blue
  },
  {
    name: "EN_CURSO",
    description: "Schedule en ejecución",
    color: "#f59e0b" // amber
  },
  {
    name: "COMPLETADO",
    description: "Schedule completado exitosamente",
    color: "#10b981" // green
  },
  {
    name: "CANCELADO",
    description: "Schedule cancelado",
    color: "#ef4444" // red
  },
  {
    name: "POSPUESTO",
    description: "Schedule pospuesto para otra fecha",
    color: "#8b5cf6" // purple
  }
];
```

### 3. Migración

```bash
npx prisma migrate dev --name separate_schedule_status
```

### 4. Seed de Estados

```typescript
// prisma/seed.ts

async function seedScheduleStatuses() {
  console.log("Seeding schedule statuses...");

  for (const status of SCHEDULE_STATUSES) {
    await prisma.scheduleStatus.upsert({
      where: { name: status.name },
      update: {},
      create: status
    });
  }
}

async function main() {
  // ... otros seeds
  await seedScheduleStatuses();
}
```

### 5. Migrar Datos Existentes

```typescript
// Script de migración
async function migrateScheduleStatuses() {
  // Mapeo de IncidentStatus → ScheduleStatus
  const statusMap = {
    "ABIERTO": "BORRADOR",
    "EN_PROGRESO": "EN_CURSO",
    "CERRADO": "COMPLETADO",
    "CANCELADO": "CANCELADO"
  };

  const schedules = await prisma.schedule.findMany({
    include: { status: true }
  });

  for (const schedule of schedules) {
    if (!schedule.status) continue;

    const newStatusName = statusMap[schedule.status.name] || "BORRADOR";
    const newStatus = await prisma.scheduleStatus.findUnique({
      where: { name: newStatusName }
    });

    if (newStatus) {
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { statusId: newStatus.id }
      });
    }
  }

  console.log(`Migrated ${schedules.length} schedule statuses`);
}
```

### 6. Actualizar Componentes

```typescript
// src/components/schedules/ScheduleStatusBadge.tsx

interface Props {
  status: ScheduleStatus;
}

export function ScheduleStatusBadge({ status }: Props) {
  const variants = {
    BORRADOR: "secondary",
    CONFIRMADO: "default",
    EN_CURSO: "warning",
    COMPLETADO: "success",
    CANCELADO: "destructive",
    POSPUESTO: "outline"
  } as const;

  return (
    <Badge
      variant={variants[status.name]}
      style={{ backgroundColor: status.color }}
    >
      {status.name}
    </Badge>
  );
}
```

## Estados Avanzados (Opcional)

Para sistemas más complejos:

```typescript
const ADVANCED_SCHEDULE_STATUSES = [
  {
    name: "PLANIFICADO",
    description: "Schedule planificado en calendario",
    color: "#06b6d4" // cyan
  },
  {
    name: "APROBADO",
    description: "Schedule aprobado por supervisor",
    color: "#14b8a6" // teal
  },
  {
    name: "RECHAZADO",
    description: "Schedule rechazado, requiere cambios",
    color: "#f97316" // orange
  },
  {
    name: "EN_REVISION",
    description: "Schedule en revisión",
    color: "#a855f7" // violet
  }
];
```

## Workflows de Estado

### Flujo Básico
```
BORRADOR → CONFIRMADO → EN_CURSO → COMPLETADO
                 ↓
             CANCELADO
```

### Flujo con Aprobación
```
BORRADOR → EN_REVISION → APROBADO → EN_CURSO → COMPLETADO
              ↓
          RECHAZADO
              ↓
          BORRADOR (revisar)
```

## Validaciones de Transición

```typescript
// src/lib/validations/schedule-status.ts

const VALID_TRANSITIONS: Record<string, string[]> = {
  BORRADOR: ["CONFIRMADO", "CANCELADO"],
  CONFIRMADO: ["EN_CURSO", "CANCELADO", "POSPUESTO"],
  EN_CURSO: ["COMPLETADO", "CANCELADO"],
  COMPLETADO: [], // Terminal state
  CANCELADO: [], // Terminal state
  POSPUESTO: ["CONFIRMADO", "CANCELADO"]
};

export function canTransitionStatus(
  fromStatus: string,
  toStatus: string
): boolean {
  const allowed = VALID_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

export function validateStatusTransition(
  schedule: Schedule,
  newStatusName: string
) {
  if (!schedule.status) {
    throw new Error("Schedule has no current status");
  }

  if (!canTransitionStatus(schedule.status.name, newStatusName)) {
    throw new Error(
      `Invalid transition: ${schedule.status.name} → ${newStatusName}`
    );
  }
}
```

## Actualizar Server Actions

```typescript
// src/lib/actions/schedules.ts

export async function updateScheduleStatus(
  scheduleId: number,
  newStatusName: string
) {
  const user = await requirePermission("schedules:update");

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { status: true }
  });

  if (!schedule) {
    throw new Error("Schedule not found");
  }

  // Validar transición
  validateStatusTransition(schedule, newStatusName);

  const newStatus = await prisma.scheduleStatus.findUnique({
    where: { name: newStatusName }
  });

  if (!newStatus) {
    throw new Error(`Status ${newStatusName} not found`);
  }

  const updated = await prisma.schedule.update({
    where: { id: scheduleId },
    data: { statusId: newStatus.id }
  });

  revalidatePath(`/admin/schedules/${scheduleId}`);
  return { success: true, data: updated };
}
```

## Testing

### Test Cases
1. **Crear schedule**: Inicia en BORRADOR
2. **Confirmar**: BORRADOR → CONFIRMADO
3. **Iniciar**: CONFIRMADO → EN_CURSO
4. **Completar**: EN_CURSO → COMPLETADO
5. **Cancelar**: Cualquier estado → CANCELADO
6. **Transición inválida**: COMPLETADO → EN_CURSO (rechazado)

## Checklist de Completado

- [ ] Crear modelo ScheduleStatus en schema
- [ ] Actualizar relación en Schedule
- [ ] Crear migración
- [ ] Seed estados de schedule
- [ ] Script de migración de datos
- [ ] Implementar validación de transiciones
- [ ] Actualizar componentes de UI
- [ ] Actualizar server actions
- [ ] Testing de transiciones
- [ ] Documentar en CLAUDE.md

## Criterio de Éxito

✅ ScheduleStatus separado de IncidentStatus
✅ Estados específicos de schedule definidos
✅ Transiciones de estado validadas
✅ Data existente migrada correctamente
✅ UI muestra estados correctamente
