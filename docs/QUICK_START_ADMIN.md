# Quick Start: Admin CRUD Implementation

## What's Been Done

### ✅ Server Actions Created (All Modules)

All server actions are ready to use in `src/lib/actions/`:

1. **users.ts** - Complete user CRUD with permissions
2. **roles.ts** - Role management with permission assignment
3. **vics.ts** - VIC management
4. **incidents.ts** - Incident tracking
5. **work-orders.ts** - Work order management
6. **parts.ts** - Inventory management
7. **schedules.ts** - Schedule management
8. **lookups.ts** - All lookup tables (States, Statuses, Types, Permissions)

### ✅ Users Module Complete

The Users module is fully functional as a reference implementation:

**Pages**:
- `/admin/users` - List all users (server component)
- `/admin/users/new` - Create user form
- `/admin/users/[id]/edit` - Edit user form

**Components**:
- `src/components/admin/users/users-table.tsx` - Table with delete
- `src/components/admin/users/user-form.tsx` - Create/edit form

**Features**:
- ✅ Full CRUD operations
- ✅ Permission checks (users:read, users:create, users:update, users:delete)
- ✅ Password hashing
- ✅ User profile management
- ✅ Role, status, and VIC assignment
- ✅ Soft delete with confirmation
- ✅ Automatic cache revalidation

### ✅ Bug Fixes Applied

1. **Prisma Query Error** - Fixed nested `where` clauses in `authz.ts`
2. **Next.js 15 Params** - Updated to use async params pattern

## How to Use Server Actions

### Pattern 1: List Page (Server Component)

```typescript
// src/app/admin/[module]/page.tsx
import { getModels } from "@/lib/actions/models";
import { ModelsTable } from "@/components/admin/models/models-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function ModelsPage() {
  const models = await getModels(); // Server action - permission checked

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Módulos</h1>
          <p className="text-muted-foreground">Descripción</p>
        </div>
        <Button asChild>
          <Link href="/admin/models/new">
            <Plus className="mr-2 h-4 w-4" />
            Agregar
          </Link>
        </Button>
      </div>

      <ModelsTable models={models} />
    </div>
  );
}
```

### Pattern 2: Table Component (Client)

```typescript
// src/components/admin/models/models-table.tsx
"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import { deleteModel } from "@/lib/actions/models";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ModelsTable({ models }: { models: Model[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;

    setDeleting(id);
    try {
      await deleteModel(id);
      router.refresh(); // Revalidate server component
    } catch (error) {
      alert("Error: " + (error as Error).message);
      setDeleting(null);
    }
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map((model) => (
            <TableRow key={model.id}>
              <TableCell>{model.name}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/models/${model.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/models/${model.id}/edit`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(model.id, model.name)}
                    disabled={deleting === model.id}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### Pattern 3: Form Component (Client)

```typescript
// src/components/admin/models/model-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createModel, updateModel } from "@/lib/actions/models";

export function ModelForm({ model, options }: FormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: model?.name || "",
    // ... other fields
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (model) {
        await updateModel(model.id, formData);
      } else {
        await createModel(formData);
      }
      router.push("/admin/models");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Información</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : model ? "Actualizar" : "Crear"}
        </Button>
      </div>
    </form>
  );
}
```

### Pattern 4: Create Page (Server Component)

```typescript
// src/app/admin/models/new/page.tsx
import { getFormOptions } from "@/lib/actions/models";
import { ModelForm } from "@/components/admin/models/model-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewModelPage() {
  const options = await getFormOptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/models">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Módulo</h1>
          <p className="text-muted-foreground">Crear un nuevo registro</p>
        </div>
      </div>

      <ModelForm options={options} />
    </div>
  );
}
```

### Pattern 5: Edit Page (Server Component)

```typescript
// src/app/admin/models/[id]/edit/page.tsx
import { getModelById, getFormOptions } from "@/lib/actions/models";
import { ModelForm } from "@/components/admin/models/model-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

export default async function EditModelPage({
  params,
}: {
  params: Promise<{ id: string }>; // Next.js 15 async params
}) {
  const { id } = await params; // Await params first
  const [model, options] = await Promise.all([
    getModelById(id),
    getFormOptions(),
  ]);

  if (!model) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/models">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Módulo</h1>
          <p className="text-muted-foreground">Modificar {model.name}</p>
        </div>
      </div>

      <ModelForm model={model} options={options} />
    </div>
  );
}
```

## Server Actions Available

### Users
- `getUsers()` - List all users
- `getUserById(id)` - Get single user
- `createUser(data)` - Create user
- `updateUser(id, data)` - Update user
- `deleteUser(id)` - Soft delete user
- `getUserFormOptions()` - Get roles, statuses, VICs

### Roles
- `getRoles()` - List all roles
- `getRoleById(id)` - Get single role
- `createRole(data)` - Create role
- `updateRole(id, data)` - Update role
- `deleteRole(id)` - Delete role
- `getAllPermissions()` - Get all permissions
- `assignPermissionsToRole(roleId, permissionIds)` - Assign permissions

### VICs
- `getVICs()` - List all VICs
- `getVICById(id)` - Get single VIC
- `createVIC(data)` - Create VIC
- `updateVIC(id, data)` - Update VIC
- `deleteVIC(id)` - Delete VIC
- `getStates()` - Get states for form

### Incidents
- `getIncidents()` - List all incidents
- `getIncidentById(id)` - Get single incident
- `createIncident(data)` - Create incident
- `updateIncident(id, data)` - Update incident
- `deleteIncident(id)` - Delete incident
- `closeIncident(id)` - Close incident
- `getIncidentFormOptions()` - Get types, statuses, VICs, users, schedules

### Work Orders
- `getWorkOrders()` - List all work orders
- `getWorkOrderById(id)` - Get single work order
- `createWorkOrder(data)` - Create work order
- `updateWorkOrder(id, data)` - Update work order
- `deleteWorkOrder(id)` - Delete work order
- `getWorkOrderFormOptions()` - Get incidents and users

### Parts
- `getParts()` - List all parts
- `getPartById(id)` - Get single part
- `createPart(data)` - Create part
- `updatePart(id, data)` - Update part
- `deletePart(id)` - Delete part
- `updatePartStock(id, quantity)` - Update stock
- `getVICsForParts()` - Get VICs for form

### Schedules
- `getSchedules()` - List all schedules
- `getScheduleById(id)` - Get single schedule
- `createSchedule(data)` - Create schedule
- `updateSchedule(id, data)` - Update schedule
- `deleteSchedule(id)` - Delete schedule
- `getVICsForSchedules()` - Get VICs for form

### Lookup Tables (from lookups.ts)
All follow the same pattern:
- `get[Type]s()` - List all
- `get[Type]ById(id)` - Get single
- `create[Type](data)` - Create
- `update[Type](id, data)` - Update
- `delete[Type](id)` - Delete

Types: States, UserStatuses, IncidentTypes, IncidentStatuses, Permissions

## Next Steps

1. **Copy the Users module pattern** for other modules
2. **Start with high-priority modules**: Roles → VICs → Incidents → Work Orders
3. **Reuse components**: Create generic DataTable, FormCard, etc.
4. **Test each module**: Create, edit, delete, permissions

## Important Notes

### Next.js 15 Changes
- **Async Params**: Always await params in dynamic routes
  ```typescript
  const { id } = await params;
  ```

### Permission Checks
- Every server action automatically checks permissions
- Throws error if user doesn't have required permission
- No need to manually check in UI components

### Cache Revalidation
- Server actions automatically revalidate paths
- Use `router.refresh()` in client components after mutations
- Cache is cleared on create/update/delete

### Soft Deletes
- All deletes set `active: false`
- Prevents orphaned records
- Maintains data integrity

## Testing Credentials

```
Admin:  admin@opusinspection.com / password123
FSR:    fsr@opusinspection.com / password123
Client: client@opusinspection.com / password123
Guest:  guest@opusinspection.com / password123
```

## Common Issues

### Issue: Permission Denied
**Solution**: Check that the user's role has the required permission in the database

### Issue: Form Not Submitting
**Solution**: Check browser console for errors, ensure all required fields are filled

### Issue: Data Not Refreshing
**Solution**: Make sure to call `router.refresh()` after mutations in client components

### Issue: Type Errors
**Solution**: Check that your TypeScript types match the Prisma schema

## Resources

- Full documentation: `docs/ADMIN_CRUD_IMPLEMENTATION.md`
- Role migration guide: `docs/ROLE_STRUCTURE.md`
- Architecture guide: `CLAUDE.md`
