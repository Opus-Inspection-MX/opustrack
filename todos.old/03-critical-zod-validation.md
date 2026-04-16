# 🔴 CRÍTICO: Validación Zod en Server Actions

## Problema
Las Server Actions no validan datos en runtime. Solo hay validación a nivel de TypeScript (compile-time), lo que no protege contra datos malformados del cliente.

**Severity**: 🟡 Media (Seguridad - Input Validation)
**Esfuerzo**: 🟡 Medio (3-4 horas)
**Impacto**: Previene datos inválidos en BD, mejora seguridad

## Estado Actual

### ✅ Validación Existe en Formularios
```typescript
// Los formularios tienen Zod schemas
const formSchema = z.object({
  title: z.string().min(3),
  priority: z.number(),
});
```

### ❌ Server Actions Sin Validación Runtime
```typescript
// src/lib/actions/incidents.ts
export async function createIncident(data: IncidentFormData) {
  // TypeScript types pero sin validación runtime
  await prisma.incident.create({ data });
}
```

**Problema**: Cliente puede enviar cualquier dato, incluyendo campos no esperados o tipos incorrectos.

## Solución

### 1. Crear Schemas Compartidos

**Archivo**: `src/lib/validations/incidents.ts`

```typescript
import { z } from "zod";

/**
 * Schema for creating an incident
 */
export const IncidentCreateSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().optional(),
  priority: z.number().int().min(1).max(10),
  typeId: z.number().int().positive(),
  statusId: z.number().int().positive(),
  vicId: z.string().cuid(),
  reportedById: z.string().cuid(),
  reportedAt: z.date().optional().default(() => new Date()),
});

/**
 * Schema for updating an incident
 */
export const IncidentUpdateSchema = IncidentCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

/**
 * Schema for deleting an incident
 */
export const IncidentDeleteSchema = z.object({
  id: z.number().int().positive(),
});

/**
 * Type inference from schema
 */
export type IncidentCreateInput = z.infer<typeof IncidentCreateSchema>;
export type IncidentUpdateInput = z.infer<typeof IncidentUpdateSchema>;
export type IncidentDeleteInput = z.infer<typeof IncidentDeleteSchema>;
```

### 2. Usar en Server Actions

**Patrón**:
```typescript
import { IncidentCreateSchema, type IncidentCreateInput } from "@/lib/validations/incidents";

export async function createIncident(data: unknown) {
  const user = await requirePermission("incidents:create");

  // Validar y parsear datos
  const validated = IncidentCreateSchema.parse(data);

  // Ahora validated tiene tipos correctos y datos válidos
  const incident = await prisma.incident.create({
    data: {
      ...validated,
      reportedById: user.id,
      vicId: user.vicId || validated.vicId,
    }
  });

  revalidatePath("/admin/incidents");
  return { success: true, data: incident };
}
```

### 3. Manejo de Errores de Validación

```typescript
import { ZodError } from "zod";

export async function createIncident(data: unknown) {
  try {
    const user = await requirePermission("incidents:create");
    const validated = IncidentCreateSchema.parse(data);

    const incident = await prisma.incident.create({ data: validated });

    revalidatePath("/admin/incidents");
    return { success: true, data: incident };

  } catch (error) {
    // Errores de validación Zod
    if (error instanceof ZodError) {
      return {
        success: false,
        error: "Validation failed",
        issues: error.issues.map(issue => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      };
    }

    // Otros errores
    console.error("Error creating incident:", error);
    return {
      success: false,
      error: "Failed to create incident",
    };
  }
}
```

### 4. Usar en Formularios (Tipo Compartido)

```typescript
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IncidentCreateSchema, type IncidentCreateInput } from "@/lib/validations/incidents";

export function IncidentForm() {
  const form = useForm<IncidentCreateInput>({
    resolver: zodResolver(IncidentCreateSchema),
  });

  const onSubmit = async (data: IncidentCreateInput) => {
    const result = await createIncident(data);
    if (!result.success) {
      // Mostrar errores
    }
  };

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>;
}
```

## Archivos a Crear

### src/lib/validations/
- [ ] `incidents.ts` - Schemas para incidents
- [ ] `work-orders.ts` - Schemas para work orders
- [ ] `parts.ts` - Schemas para parts
- [ ] `work-activities.ts` - Schemas para activities
- [ ] `users.ts` - Schemas para users
- [ ] `schedules.ts` - Schemas para schedules
- [ ] `common.ts` - Schemas compartidos (pagination, filters)

## Patrón de Schemas

```typescript
// Schemas base
export const {Entity}CreateSchema = z.object({...});
export const {Entity}UpdateSchema = {Entity}CreateSchema.partial().extend({
  id: z.number().int().positive(),
});
export const {Entity}DeleteSchema = z.object({
  id: z.number().int().positive(),
});

// Schemas para queries
export const {Entity}QuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Type inference
export type {Entity}CreateInput = z.infer<typeof {Entity}CreateSchema>;
export type {Entity}UpdateInput = z.infer<typeof {Entity}UpdateSchema>;
export type {Entity}QueryInput = z.infer<typeof {Entity}QuerySchema>;
```

## Validaciones Comunes

```typescript
// src/lib/validations/common.ts
import { z } from "zod";

// IDs
export const cuidSchema = z.string().cuid();
export const uuidSchema = z.string().uuid();
export const intIdSchema = z.number().int().positive();

// Timestamps
export const dateSchema = z.date();
export const dateStringSchema = z.string().datetime();

// Pagination
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Sorting
export const sortOrderSchema = z.enum(["asc", "desc"]);

// Status
export const booleanStringSchema = z
  .string()
  .transform((val) => val === "true" || val === "1");

// File uploads
export const base64FileSchema = z.object({
  filename: z.string().min(1),
  mimetype: z.string().regex(/^[a-z]+\/[a-z0-9\-\+\.]+$/),
  base64: z.string().min(1),
  size: z.number().int().positive().max(10 * 1024 * 1024), // 10MB
});
```

## Testing

### Test Cases
1. **Valid Data**: Datos correctos pasan validación
2. **Missing Required**: Campos requeridos faltantes son rechazados
3. **Wrong Type**: Tipos incorrectos son rechazados
4. **Out of Range**: Valores fuera de rango son rechazados
5. **Invalid Format**: Formatos inválidos (email, url) son rechazados
6. **Extra Fields**: Campos extra son ignorados (strip)

### Ejemplo de Test
```typescript
import { describe, it, expect } from "vitest";
import { IncidentCreateSchema } from "@/lib/validations/incidents";

describe("IncidentCreateSchema", () => {
  it("should accept valid incident data", () => {
    const valid = {
      title: "Test Incident",
      priority: 5,
      typeId: 1,
      statusId: 1,
      vicId: "clx123456789",
      reportedById: "clx987654321",
    };

    expect(() => IncidentCreateSchema.parse(valid)).not.toThrow();
  });

  it("should reject title too short", () => {
    const invalid = { ...valid, title: "ab" };
    expect(() => IncidentCreateSchema.parse(invalid)).toThrow();
  });

  it("should reject priority out of range", () => {
    const invalid = { ...valid, priority: 11 };
    expect(() => IncidentCreateSchema.parse(invalid)).toThrow();
  });
});
```

## Checklist de Completado

- [ ] Crear schemas en `src/lib/validations/common.ts`
- [ ] Crear schemas en `src/lib/validations/incidents.ts`
- [ ] Crear schemas en `src/lib/validations/work-orders.ts`
- [ ] Crear schemas en `src/lib/validations/parts.ts`
- [ ] Aplicar validación en todas las server actions
- [ ] Actualizar formularios para usar tipos compartidos
- [ ] Testing unitario de schemas
- [ ] Testing de errores de validación en UI
- [ ] Documentar patrón en CLAUDE.md

## Criterio de Éxito

✅ Todas las server actions validan entrada con Zod
✅ Formularios usan mismos schemas (single source of truth)
✅ Errores de validación se muestran en UI
✅ Datos inválidos no llegan a la BD
✅ Tests unitarios de schemas pasando
