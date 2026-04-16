# 🟡 MODERADO: Auto-cierre de Incidents

## Problema
El sistema dice que los incidents se cierran automáticamente cuando todos sus work orders están completos, pero esta lógica no está implementada explícitamente.

**Severity**: 🟡 Media (Feature Incompleta)
**Esfuerzo**: 🟡 Medio (2-3 horas)
**Impacto**: Automatización del flujo de negocio

## Descripción

Del CLAUDE.md:
```
Automatic closure logic: Incident status changes when all related work orders complete
```

Pero no hay una función `checkAndCloseIncident()` que implemente esto.

## Solución

### 1. Crear Helper de Auto-cierre

**Archivo**: `src/lib/actions/incidents.ts`

```typescript
/**
 * Checks if all work orders for an incident are completed
 * If so, automatically closes the incident
 */
export async function checkAndCloseIncident(incidentId: number) {
  const user = await requireAuth();

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId, active: true },
    include: {
      workOrders: {
        where: { active: true },
        include: { status: true }
      },
      status: true
    }
  });

  if (!incident) {
    throw new Error("Incident not found");
  }

  // Si no hay work orders, no hacer nada
  if (incident.workOrders.length === 0) {
    return { autoClose: false, reason: "No work orders" };
  }

  // Verificar si todos están completados
  const allCompleted = incident.workOrders.every(wo =>
    wo.status?.name === "CERRADO" || wo.status?.name === "COMPLETADO"
  );

  if (!allCompleted) {
    return { autoClose: false, reason: "Work orders pending" };
  }

  // Ya está cerrado
  if (incident.status?.name === "CERRADO") {
    return { autoClose: false, reason: "Already closed" };
  }

  // Obtener status ID de "CERRADO"
  const closedStatus = await prisma.incidentStatus.findFirst({
    where: { name: "CERRADO" }
  });

  if (!closedStatus) {
    console.error("CERRADO status not found in database");
    return { autoClose: false, reason: "Status not found" };
  }

  // Cerrar el incident
  await prisma.incident.update({
    where: { id: incidentId },
    data: {
      statusId: closedStatus.id,
      resolvedAt: new Date()
    }
  });

  // Revalidar cache
  revalidatePath(`/admin/incidents/${incidentId}`);
  revalidatePath("/admin/incidents");
  revalidatePath("/fsr/incidents");
  revalidatePath("/client/incidents");

  return { autoClose: true, status: closedStatus.name };
}
```

### 2. Llamar al Completar Work Order

**Archivo**: `src/lib/actions/work-orders.ts`

```typescript
export async function completeWorkOrder(workOrderId: number) {
  const user = await requirePermission("work-orders:update");

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { incident: true }
  });

  if (!workOrder) {
    throw new Error("Work order not found");
  }

  // Obtener status "COMPLETADO" o "CERRADO"
  const completedStatus = await prisma.workOrderStatus.findFirst({
    where: { name: { in: ["COMPLETADO", "CERRADO"] } }
  });

  if (!completedStatus) {
    throw new Error("Completed status not found");
  }

  // Actualizar work order
  const updated = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      statusId: completedStatus.id,
      finishedAt: new Date()
    }
  });

  // Intentar cerrar incident automáticamente
  if (workOrder.incidentId) {
    await checkAndCloseIncident(workOrder.incidentId);
  }

  revalidatePath(`/admin/work-orders/${workOrderId}`);
  revalidatePath("/admin/work-orders");

  return { success: true, data: updated };
}
```

### 3. Agregar Campo `resolvedAt` al Schema (si no existe)

**Archivo**: `prisma/schema.prisma`

```prisma
model Incident {
  // ... campos existentes
  resolvedAt DateTime?  // Timestamp cuando se resolvió
  // ... resto del modelo
}
```

Luego correr:
```bash
npm run db:migrate -- --name add_resolved_at_to_incidents
```

### 4. Notificación de Auto-cierre (Opcional)

**Opción A: Log en consola**
```typescript
console.log(`[AUTO-CLOSE] Incident #${incidentId} auto-closed - all work orders completed`);
```

**Opción B: Crear registro de auditoría**
```typescript
await prisma.incidentLog.create({
  data: {
    incidentId,
    action: "AUTO_CLOSED",
    description: "Incident automatically closed - all work orders completed",
    userId: user.id
  }
});
```

**Opción C: Notificar usuarios (futuro)**
```typescript
await notifyUsers({
  incidentId,
  type: "INCIDENT_CLOSED",
  message: "Your incident has been resolved"
});
```

## Estados de Work Order Válidos

Definir claramente qué estados significan "completado":

```typescript
const COMPLETED_STATUSES = ["CERRADO", "COMPLETADO", "RESUELTO", "FINALIZADO"];

const allCompleted = incident.workOrders.every(wo =>
  COMPLETED_STATUSES.includes(wo.status?.name || "")
);
```

## Edge Cases

### 1. Work Order Reabierto
Si un WO cerrado se reabre, ¿se reabre el incident?

```typescript
export async function reopenWorkOrder(workOrderId: number) {
  // ... reabrir WO

  if (workOrder.incidentId) {
    // Reabrir incident si estaba cerrado
    const incident = await prisma.incident.findUnique({
      where: { id: workOrder.incidentId },
      include: { status: true }
    });

    if (incident?.status?.name === "CERRADO") {
      const reopenedStatus = await prisma.incidentStatus.findFirst({
        where: { name: "EN_PROGRESO" }
      });

      await prisma.incident.update({
        where: { id: workOrder.incidentId },
        data: {
          statusId: reopenedStatus?.id,
          resolvedAt: null
        }
      });
    }
  }
}
```

### 2. Work Order Eliminado (Soft Delete)
Si se elimina un WO, ¿se intenta cerrar el incident?

```typescript
export async function deleteWorkOrder(workOrderId: number) {
  // ... soft delete WO

  if (workOrder.incidentId) {
    // Intentar auto-cierre (solo cuenta WO activos)
    await checkAndCloseIncident(workOrder.incidentId);
  }
}
```

### 3. Incident Sin Work Orders
Si un incident no tiene WOs, ¿se puede cerrar?

```typescript
// En checkAndCloseIncident()
if (incident.workOrders.length === 0) {
  // No cerrar automáticamente
  return { autoClose: false, reason: "No work orders" };
}
```

## UI Feedback

### Badge de Auto-cierre
```typescript
// En incident detail page
{incident.resolvedAt && (
  <Badge variant="success">
    Auto-closed on {format(incident.resolvedAt, "PPP")}
  </Badge>
)}
```

### Indicador en Work Order
```typescript
// En work order form
{workOrder.incident && (
  <Alert>
    <Info className="h-4 w-4" />
    <AlertDescription>
      This is the last pending work order. Completing it will automatically close the incident.
    </AlertDescription>
  </Alert>
)}
```

## Testing Manual

### Test 1: Cierre Automático
1. Crear incident con 3 work orders
2. Completar WO 1 → Incident sigue ABIERTO
3. Completar WO 2 → Incident sigue ABIERTO
4. Completar WO 3 → Incident se cierra automáticamente

### Test 2: Reapertura
1. Incident cerrado con todos los WO completos
2. Reabrir un WO
3. Verificar que incident se reabre

### Test 3: Sin Work Orders
1. Incident sin work orders
2. Verificar que NO se cierra automáticamente

## Checklist de Completado

- [ ] Implementar `checkAndCloseIncident()`
- [ ] Llamar desde `completeWorkOrder()`
- [ ] Agregar campo `resolvedAt` al schema (si falta)
- [ ] Correr migración
- [ ] Implementar lógica de reapertura
- [ ] Testing manual de auto-cierre
- [ ] Testing de reapertura
- [ ] Agregar UI feedback (badges)
- [ ] Documentar comportamiento en CLAUDE.md

## Criterio de Éxito

✅ Incident se cierra automáticamente al completar último WO
✅ Incident se reabre si un WO cerrado se reabre
✅ Campo `resolvedAt` registra timestamp de cierre
✅ UI muestra indicador de auto-cierre
✅ Logs registran acción de auto-cierre
