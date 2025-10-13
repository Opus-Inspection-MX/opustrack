# Admin CRUD Implementation Guide

## Overview

This document outlines the comprehensive CRUD (Create, Read, Update, Delete) operations for all admin modules using Next.js server components and server actions with proper role-based permission checks.

## Architecture

### Server Actions (No API Routes)
All CRUD operations use Next.js server actions instead of API routes:
- **Location**: `src/lib/actions/`
- **Benefits**: Type-safe, direct database access, automatic form handling
- **Security**: Permission checks on every action using `requirePermission()`

### Server Components
All admin pages are server components that:
- Fetch data directly from database
- Pass data to client components for interactivity
- Provide better SEO and performance

## Implemented Server Actions

### 1. Users (`src/lib/actions/users.ts`)

**Functions**:
- `getUsers()` - Get all active users with relations (role, status, VIC, profile)
- `getUserById(id)` - Get single user by ID
- `createUser(data)` - Create new user with hashed password and profile
- `updateUser(id, data)` - Update user (password optional)
- `deleteUser(id)` - Soft delete user
- `getUserFormOptions()` - Get roles, statuses, and VICs for form

**Permissions Required**:
- `users:read` - View users
- `users:create` - Create users
- `users:update` - Update users
- `users:delete` - Delete users

**Features**:
- Password hashing with bcrypt
- User profile creation/update
- VIC assignment (can be null for admins)
- Automatic cache revalidation

### 2. Roles (`src/lib/actions/roles.ts`)

**Functions**:
- `getRoles()` - Get all roles with permission counts
- `getRoleById(id)` - Get role with assigned permissions
- `createRole(data)` - Create role with initial permissions
- `updateRole(id, data)` - Update role and reassign permissions
- `deleteRole(id)` - Soft delete (checks for assigned users)
- `getAllPermissions()` - Get all permissions for assignment
- `assignPermissionsToRole(roleId, permissionIds)` - Bulk assign permissions

**Permissions Required**:
- `roles:read` - View roles
- `roles:create` - Create roles
- `roles:update` - Update roles
- `roles:delete` - Delete roles
- `permissions:read` - View permissions

**Features**:
- Prevents deletion if users are assigned
- Bulk permission assignment
- Permission management interface

### 3. Vehicle Inspection Centers (`src/lib/actions/vics.ts`)

**Functions**:
- `getVICs()` - Get all VICs with state and counts
- `getVICById(id)` - Get VIC with users, incidents, parts
- `createVIC(data)` - Create new VIC
- `updateVIC(id, data)` - Update VIC details
- `deleteVIC(id)` - Soft delete (checks for assigned users)
- `getStates()` - Get all states for form

**Permissions Required**:
- `vics:read` - View VICs
- `vics:create` - Create VICs
- `vics:update` - Update VICs
- `vics:delete` - Delete VICs

**Features**:
- State assignment
- Prevents deletion with active users
- Related data counts (users, incidents, parts)

### 4. Incidents (`src/lib/actions/incidents.ts`)

**Functions**:
- `getIncidents()` - Get all incidents with relations
- `getIncidentById(id)` - Get incident with work orders
- `createIncident(data)` - Create new incident
- `updateIncident(id, data)` - Update incident
- `deleteIncident(id)` - Soft delete incident
- `closeIncident(id)` - Close incident (sets status and resolvedAt)
- `getIncidentFormOptions()` - Get types, statuses, VICs, users, schedules

**Permissions Required**:
- `incidents:read` - View incidents
- `incidents:create` - Create incidents
- `incidents:update` - Update incidents
- `incidents:delete` - Delete incidents
- `incidents:close` - Close incidents

**Features**:
- Priority and SLA tracking
- Status workflow
- VIC and schedule association
- Reporter tracking

### 5. Work Orders (`src/lib/actions/work-orders.ts`)

**Functions**:
- `getWorkOrders()` - Get all work orders with incident and assignee
- `getWorkOrderById(id)` - Get work order with activities and parts
- `createWorkOrder(data)` - Create new work order
- `updateWorkOrder(id, data)` - Update work order
- `deleteWorkOrder(id)` - Soft delete work order
- `getWorkOrderFormOptions()` - Get incidents and users for assignment

**Permissions Required**:
- `work-orders:read` - View work orders
- `work-orders:create` - Create work orders
- `work-orders:update` - Update work orders
- `work-orders:delete` - Delete work orders

**Features**:
- Incident association
- User assignment
- Status tracking
- Started/finished timestamps
- Work activities and parts

### 6. Parts/Inventory (`src/lib/actions/parts.ts`)

**Functions**:
- `getParts()` - Get all parts with VIC and usage count
- `getPartById(id)` - Get part with work part history
- `createPart(data)` - Create new part
- `updatePart(id, data)` - Update part details
- `deletePart(id)` - Soft delete part
- `updatePartStock(id, quantity)` - Increment/decrement stock
- `getVICsForParts()` - Get VICs for part assignment

**Permissions Required**:
- `parts:read` - View parts
- `parts:create` - Create parts
- `parts:update` - Update parts
- `parts:delete` - Delete parts

**Features**:
- VIC-specific inventory
- Stock management
- Price tracking
- Usage history

### 7. Schedules (`src/lib/actions/schedules.ts`)

**Functions**:
- `getSchedules()` - Get all schedules with VIC
- `getScheduleById(id)` - Get schedule with linked incidents
- `createSchedule(data)` - Create new schedule
- `updateSchedule(id, data)` - Update schedule
- `deleteSchedule(id)` - Soft delete (checks for linked incidents)
- `getVICsForSchedules()` - Get VICs for schedule

**Permissions Required**:
- `schedules:read` - View schedules
- `schedules:create` - Create schedules
- `schedules:update` - Update schedules
- `schedules:delete` - Delete schedules

**Features**:
- VIC association
- Scheduled date tracking
- Incident linking
- Prevents deletion with linked incidents

### 8. Lookup Tables (`src/lib/actions/lookups.ts`)

Comprehensive CRUD for all lookup/reference tables:

#### States
- `getStatesAdmin()` - Get all states with VIC counts
- `getStateById(id)` - Get state with VICs
- `createState(data)` - Create state
- `updateState(id, data)` - Update state
- `deleteState(id)` - Soft delete (checks for VICs)

#### User Statuses
- `getUserStatuses()` - Get all user statuses
- `getUserStatusById(id)` - Get status details
- `createUserStatus(data)` - Create status
- `updateUserStatus(id, data)` - Update status
- `deleteUserStatus(id)` - Soft delete (checks for users)

#### Incident Types
- `getIncidentTypes()` - Get all incident types
- `getIncidentTypeById(id)` - Get type details
- `createIncidentType(data)` - Create type
- `updateIncidentType(id, data)` - Update type
- `deleteIncidentType(id)` - Soft delete (checks for incidents)

#### Incident Statuses
- `getIncidentStatuses()` - Get all incident statuses
- `getIncidentStatusById(id)` - Get status details
- `createIncidentStatus(data)` - Create status
- `updateIncidentStatus(id, data)` - Update status
- `deleteIncidentStatus(id)` - Soft delete (checks for incidents)

#### Permissions
- `getPermissions()` - Get all permissions
- `getPermissionById(id)` - Get permission with roles
- `createPermission(data)` - Create permission
- `updatePermission(id, data)` - Update permission
- `deletePermission(id)` - Soft delete (checks for roles)

**Permissions Required**:
- Uses the corresponding module permissions (users, vics, incidents, permissions)

## Implemented UI Components

### Users Module

**Components Created**:
- `src/components/admin/users/users-table.tsx` - Client component for table with delete action
- `src/components/admin/users/user-form.tsx` - Client form component with validation

**Pages Updated**:
- `src/app/admin/users/page.tsx` - List page (server component)
- `src/app/admin/users/new/page.tsx` - Create page (server component)
- `src/app/admin/users/[id]/edit/page.tsx` - Edit page (server component)

**Features**:
- Full CRUD with server actions
- Role, status, and VIC assignment
- User profile management (phone, emergency contact, job position)
- Password hashing
- Soft delete confirmation
- Automatic redirects and cache revalidation

## Remaining Work

### Priority 1: Core Module UIs

1. **Roles Management**
   - Update `src/app/admin/roles/page.tsx` - List with permissions count
   - Update `src/app/admin/roles/new/page.tsx` - Create with permission selection
   - Update `src/app/admin/roles/[id]/edit/page.tsx` - Edit role
   - Update `src/app/admin/roles/[id]/permissions/page.tsx` - Permission assignment UI
   - Create `src/components/admin/roles/role-form.tsx`
   - Create `src/components/admin/roles/roles-table.tsx`
   - Create `src/components/admin/roles/permission-selector.tsx`

2. **VIC Management**
   - Update `src/app/admin/vic-centers/page.tsx` - List with statistics
   - Update `src/app/admin/vic-centers/new/page.tsx` - Create VIC
   - Update `src/app/admin/vic-centers/[id]/edit/page.tsx` - Edit VIC
   - Create `src/app/admin/vic-centers/[id]/page.tsx` - VIC detail view
   - Create `src/components/admin/vics/vic-form.tsx`
   - Create `src/components/admin/vics/vics-table.tsx`

3. **Incidents Management**
   - Update `src/app/admin/incidents/page.tsx` - List with filters
   - Update `src/app/admin/incidents/new/page.tsx` - Create incident
   - Update `src/app/admin/incidents/[id]/edit/page.tsx` - Edit incident
   - Create `src/app/admin/incidents/[id]/page.tsx` - Detail with work orders
   - Create `src/components/admin/incidents/incident-form.tsx`
   - Create `src/components/admin/incidents/incidents-table.tsx`

4. **Work Orders Management**
   - Update `src/app/admin/work-orders/page.tsx` - List with status
   - Update `src/app/admin/work-orders/new/page.tsx` - Create work order
   - Update `src/app/admin/work-orders/[id]/edit/page.tsx` - Edit work order
   - Create `src/app/admin/work-orders/[id]/page.tsx` - Detail with activities
   - Create `src/components/admin/work-orders/work-order-form.tsx`
   - Create `src/components/admin/work-orders/work-orders-table.tsx`

### Priority 2: Supporting Modules

5. **Parts/Inventory**
   - Update `src/app/admin/parts/page.tsx` - List with stock levels
   - Update `src/app/admin/parts/new/page.tsx` - Create part
   - Create `src/app/admin/parts/[id]/edit/page.tsx` - Edit part
   - Create `src/app/admin/parts/[id]/page.tsx` - Part detail with history
   - Create `src/components/admin/parts/part-form.tsx`
   - Create `src/components/admin/parts/parts-table.tsx`

6. **Schedules**
   - Update `src/app/admin/schedules/page.tsx` - Calendar/list view
   - Update `src/app/admin/schedules/new/page.tsx` - Create schedule
   - Update `src/app/admin/schedules/[id]/edit/page.tsx` - Edit schedule
   - Update `src/app/admin/schedules/[id]/page.tsx` - Detail with incidents
   - Create `src/components/admin/schedules/schedule-form.tsx`
   - Create `src/components/admin/schedules/schedules-table.tsx`

### Priority 3: Lookup Tables

7. **States**
   - Update `src/app/admin/states/page.tsx` - List
   - Update `src/app/admin/states/new/page.tsx` - Create
   - Update `src/app/admin/states/[id]/edit/page.tsx` - Edit
   - Create simple form components

8. **User Statuses, Incident Types, Incident Statuses**
   - Similar pattern to States
   - Simple CRUD interfaces

9. **Permissions Management**
   - Update `src/app/admin/permissions/page.tsx` - List grouped by resource
   - Update `src/app/admin/permissions/new/page.tsx` - Create
   - Update `src/app/admin/permissions/[id]/edit/page.tsx` - Edit
   - Show which roles have each permission

### Priority 4: Dashboard

10. **Admin Dashboard**
    - Update `src/app/admin/page.tsx` with real data:
      - Total users count
      - Active incidents count
      - Open work orders count
      - Scheduled tasks count
      - Recent incidents list (from database)
      - Pending work orders list (from database)
      - Quick stats cards
      - Charts (optional)

## Implementation Pattern

For each module, follow this pattern:

### 1. List Page (Server Component)
```typescript
import { getModels } from "@/lib/actions/models";
import { ModelsTable } from "@/components/admin/models/models-table";

export default async function ModelsPage() {
  const models = await getModels();
  return <ModelsTable models={models} />;
}
```

### 2. Table Component (Client Component)
```typescript
"use client";

import { deleteModel } from "@/lib/actions/models";
import { useRouter } from "next/navigation";

export function ModelsTable({ models }) {
  const router = useRouter();

  const handleDelete = async (id) => {
    if (confirm("Are you sure?")) {
      await deleteModel(id);
      router.refresh();
    }
  };

  return <Table>...</Table>;
}
```

### 3. Form Component (Client Component)
```typescript
"use client";

import { useState } from "react";
import { createModel, updateModel } from "@/lib/actions/models";

export function ModelForm({ model, options }) {
  const [formData, setFormData] = useState(model || defaultData);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (model) {
      await updateModel(model.id, formData);
    } else {
      await createModel(formData);
    }
    router.push("/admin/models");
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 4. Create Page (Server Component)
```typescript
import { getFormOptions } from "@/lib/actions/models";
import { ModelForm } from "@/components/admin/models/model-form";

export default async function NewModelPage() {
  const options = await getFormOptions();
  return <ModelForm options={options} />;
}
```

### 5. Edit Page (Server Component)
```typescript
import { getModelById, getFormOptions } from "@/lib/actions/models";
import { ModelForm } from "@/components/admin/models/model-form";

export default async function EditModelPage({ params }) {
  const [model, options] = await Promise.all([
    getModelById(params.id),
    getFormOptions(),
  ]);

  if (!model) notFound();
  return <ModelForm model={model} options={options} />;
}
```

## Security Considerations

1. **Permission Checks**: Every server action checks permissions using `requirePermission()`
2. **Soft Deletes**: All deletes are soft (set `active: false`)
3. **Relationship Validation**: Prevents deletion of records with dependencies
4. **Password Hashing**: Always hash passwords with bcrypt
5. **Input Validation**: Validate all form inputs
6. **CSRF Protection**: Built-in with Next.js server actions

## Testing Checklist

For each module, test:
- [ ] List view displays all records
- [ ] Create form validates required fields
- [ ] Create action saves to database
- [ ] Edit form pre-populates existing data
- [ ] Update action saves changes
- [ ] Delete shows confirmation dialog
- [ ] Delete performs soft delete
- [ ] Permission checks prevent unauthorized access
- [ ] Relationships prevent orphaned records
- [ ] Cache revalidation updates UI

## Common UI Components Needed

Create these reusable components:

1. **DataTable** - Generic table with sorting, filtering, pagination
2. **FormCard** - Consistent card wrapper for forms
3. **DeleteButton** - Reusable delete button with confirmation
4. **StatusBadge** - Consistent badge styling
5. **PageHeader** - Standard page header with title and actions
6. **LoadingState** - Loading skeleton components
7. **EmptyState** - Empty state for lists
8. **ErrorBoundary** - Error handling wrapper

## Next Steps

1. Start with Roles module (high priority for permissions management)
2. Then VIC module (foundational for other modules)
3. Then Incidents (core business logic)
4. Then Work Orders (depends on incidents)
5. Then supporting modules (Parts, Schedules)
6. Finally lookup tables and dashboard

## Performance Optimizations

1. Use `Promise.all()` to fetch related data in parallel
2. Implement pagination for large lists
3. Add search and filtering
4. Cache static data (roles, statuses)
5. Use React Suspense for loading states
6. Optimize database queries with proper indexes

## Future Enhancements

1. Bulk operations (delete multiple, bulk assign)
2. Export to CSV/Excel
3. Advanced filtering and search
4. Audit logs for all changes
5. File uploads for attachments
6. Real-time updates with WebSockets
7. Email notifications
8. Mobile-responsive improvements
9. Dark mode support
10. Internationalization (i18n)
