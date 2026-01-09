# 🔴 CRÍTICO: Agregar Transacciones a Operaciones Críticas

## Problema
Operaciones que modifican múltiples tablas no usan transacciones de Prisma, lo que puede causar inconsistencias si una operación falla parcialmente.

**Severity**: 🟡 Media (Integridad de Datos)
**Esfuerzo**: 🟢 Bajo (1-2 horas)
**Impacto**: Previene estados inconsistentes en la BD

## Ejemplos de Operaciones que Necesitan Transacciones

### 1. Asignar Incident a FSR (crea WorkOrder + actualiza Incident)

**Actual**:
```typescript
// Si falla la segunda operación, WorkOrder queda huérfano
const workOrder = await prisma.workOrder.create({...});
await prisma.incident.update({...});
```

**Correcto**:
```typescript
return await prisma.$transaction(async (tx) => {
  const workOrder = await tx.workOrder.create({...});
  await tx.incident.update({...});
  return workOrder;
});
```

### 2. Agregar WorkPart (crea WorkPart + decrementa stock)

**Actual**:
```typescript
// Si falla el decremento, WorkPart queda sin afectar stock
const workPart = await prisma.workPart.create({...});
await prisma.part.update({
  where: { id: partId },
  data: { stock: { decrement: quantity } }
});
```

**Correcto**:
```typescript
return await prisma.$transaction(async (tx) => {
  const workPart = await tx.workPart.create({...});
  await tx.part.update({
    where: { id: partId },
    data: { stock: { decrement: quantity } }
  });
  return workPart;
});
```

### 3. Soft Delete con Validación de Hijos

**Actual**:
```typescript
// Race condition: pueden crearse hijos entre check y delete
const count = await prisma.workOrder.count({...});
if (count > 0) throw new Error("...");
await prisma.incident.update({ data: { active: false } });
```

**Correcto**:
```typescript
return await prisma.$transaction(async (tx) => {
  const count = await tx.workOrder.count({...});
  if (count > 0) throw new Error("...");
  await tx.incident.update({ data: { active: false } });
});
```

## Archivos a Modificar

### src/lib/actions/incidents.ts
- [ ] `assignIncidentToFSR()` - Crea WO + actualiza incident
- [ ] `deleteIncident()` - Valida hijos + soft delete

### src/lib/actions/work-orders.ts
- [ ] `createWorkOrderFromIncident()` - Crea WO + actualiza incident
- [ ] `completeWorkOrder()` - Actualiza WO + checa incident
- [ ] `deleteWorkOrder()` - Valida attachments/parts + soft delete

### src/lib/actions/parts.ts
- [ ] `addWorkPart()` - Crea WorkPart + decrementa stock
- [ ] `deleteWorkPart()` - Elimina WorkPart + restaura stock
- [ ] `updateWorkPart()` - Actualiza cantidad + ajusta stock

### src/lib/actions/work-activities.ts
- [ ] `createWorkActivity()` - Si actualiza timestamp del WO también

### src/lib/actions/schedules.ts
- [ ] `deleteSchedule()` - Si desasocia incidents automáticamente

## Patrón de Implementación

```typescript
export async function operacionCritica(params: Params) {
  const user = await requirePermission("resource:action");

  // Toda la lógica dentro de la transacción
  return await prisma.$transaction(async (tx) => {
    // 1. Validaciones que requieren queries
    const existing = await tx.table.findUnique({...});
    if (!existing) throw new Error("Not found");

    // 2. Operación principal
    const result = await tx.table.create({...});

    // 3. Operaciones relacionadas
    await tx.relatedTable.update({...});
    await tx.anotherTable.delete({...});

    // 4. Revalidación de cache (FUERA de transacción)
    // Nota: revalidatePath debe ir después del return

    return result;
  });

  // Cache revalidation después de commit exitoso
  revalidatePath("/path");
}
```

## Consideraciones Importantes

### ✅ Incluir en Transacción
- Múltiples escrituras relacionadas
- Validaciones + modificaciones
- Operaciones que deben ser atómicas
- Decrementos/incrementos de contadores

### ❌ NO Incluir en Transacción
- `revalidatePath()` - Debe ir después del commit
- Operaciones de lectura simple
- Llamadas a APIs externas
- Operaciones de archivo (uploads, deletes)

### 🎯 Manejo de Errores
```typescript
try {
  const result = await prisma.$transaction(async (tx) => {
    // Operaciones...
  });
  revalidatePath("/path");
  return { success: true, data: result };
} catch (error) {
  console.error("Transaction failed:", error);
  return { success: false, error: "Operation failed" };
}
```

## Testing

### Test Cases
1. **Happy Path**: Todas las operaciones exitosas
2. **Rollback**: Forzar error en segunda operación, verificar que primera también se revierta
3. **Stock Integrity**: Agregar WorkPart, forzar error, verificar que stock no cambió
4. **Concurrent Access**: Múltiples usuarios modificando mismo recurso

### Testing Manual
```typescript
// Ejemplo: Test de rollback en addWorkPart
const initialStock = await prisma.part.findUnique({ where: { id: partId } });

try {
  // Forzar error en segunda operación (ej: vicId inválido)
  await addWorkPart({ partId, quantity: 5, workOrderId: "invalid" });
} catch (error) {
  // Verificar que stock NO cambió
  const finalStock = await prisma.part.findUnique({ where: { id: partId } });
  expect(finalStock.stock).toBe(initialStock.stock);
}
```

## Checklist de Completado

- [ ] Identificar todas las operaciones multi-tabla
- [ ] Implementar transacciones en `incidents.ts`
- [ ] Implementar transacciones en `work-orders.ts`
- [ ] Implementar transacciones en `parts.ts`
- [ ] Implementar transacciones en otras actions
- [ ] Verificar que `revalidatePath` está fuera de transacciones
- [ ] Testing manual de rollback
- [ ] Testing de stock integrity
- [ ] Documentar patrón en CLAUDE.md

## Criterio de Éxito

✅ Todas las operaciones multi-tabla usan `$transaction`
✅ Rollback funciona correctamente ante errores
✅ Stock de parts mantiene integridad
✅ No hay estados inconsistentes en BD
✅ Performance no se degrada significativamente
