# Complete CRUD Operations Reference

This document provides a comprehensive reference for all CRUD (Create, Read, Update, Delete) operations available in OpusTrack.

## Table of Contents
1. [User Status](#user-status)
2. [Incident Types](#incident-types)
3. [Incident Status](#incident-status)
4. [Work Activities](#work-activities)
5. [Work Parts](#work-parts)
6. [States](#states)
7. [Schedules](#schedules)

---

## User Status

**File:** `src/lib/actions/lookups.ts:98-183`

User statuses define the state of user accounts (ACTIVO, INACTIVO, SUSPENDIDO).

### Permissions Required
- Read: `user-status:read`
- Create: `user-status:create`
- Update: `user-status:update`
- Delete: `user-status:delete`

### Available Functions

```typescript
// Get all user statuses
getUserStatuses(): Promise<UserStatus[]>
// Returns: Array of user statuses with user count

// Get single user status by ID
getUserStatusById(id: number): Promise<UserStatus | null>
// Returns: User status with user count

// Create new user status
createUserStatus(data: UserStatusFormData): Promise<{ success: boolean; data: UserStatus }>
// Input: { name: string }
// Revalidates: /admin/user-status

// Update existing user status
updateUserStatus(id: number, data: UserStatusFormData): Promise<{ success: boolean; data: UserStatus }>
// Input: { name: string }
// Revalidates: /admin/user-status, /admin/user-status/{id}

// Delete user status (soft delete)
deleteUserStatus(id: number): Promise<void>
// Validates: Cannot delete if users are using this status
// Revalidates: /admin/user-status
// Redirects: /admin/user-status
```

### Usage Example
```typescript
import {
  getUserStatuses,
  createUserStatus,
  updateUserStatus,
  deleteUserStatus
} from "@/lib/actions/lookups";

// List all user statuses
const statuses = await getUserStatuses();

// Create new status
await createUserStatus({ name: "PENDIENTE" });

// Update status
await updateUserStatus(1, { name: "ACTIVO_MODIFICADO" });

// Delete status (checks for users first)
await deleteUserStatus(1);
```

---

## Incident Types

**File:** `src/lib/actions/lookups.ts:185-273`

Incident types categorize incidents (REPARACION, MANTENIMIENTO, OTROS).

### Permissions Required
- Read: `incident-types:read`
- Create: `incident-types:create`
- Update: `incident-types:update`
- Delete: `incident-types:delete`

### Available Functions

```typescript
// Get all incident types
getIncidentTypes(): Promise<IncidentType[]>
// Returns: Array of incident types with incident count

// Get single incident type by ID
getIncidentTypeById(id: number): Promise<IncidentType | null>
// Returns: Incident type with incident count

// Create new incident type
createIncidentType(data: IncidentTypeFormData): Promise<{ success: boolean; data: IncidentType }>
// Input: { name: string; description?: string }
// Revalidates: /admin/incident-types

// Update existing incident type
updateIncidentType(id: number, data: IncidentTypeFormData): Promise<{ success: boolean; data: IncidentType }>
// Input: { name: string; description?: string }
// Revalidates: /admin/incident-types, /admin/incident-types/{id}

// Delete incident type (soft delete)
deleteIncidentType(id: number): Promise<void>
// Validates: Cannot delete if incidents are using this type
// Revalidates: /admin/incident-types
// Redirects: /admin/incident-types
```

### Usage Example
```typescript
import {
  getIncidentTypes,
  createIncidentType,
  updateIncidentType,
  deleteIncidentType
} from "@/lib/actions/lookups";

// List all incident types
const types = await getIncidentTypes();

// Create new type
await createIncidentType({
  name: "EMERGENCIA",
  description: "Incidentes de emergencia crítica"
});

// Update type
await updateIncidentType(1, {
  name: "REPARACION_URGENTE",
  description: "Reparaciones urgentes"
});

// Delete type (checks for incidents first)
await deleteIncidentType(1);
```

---

## Incident Status

**File:** `src/lib/actions/lookups.ts:275-360`

Incident statuses track the lifecycle of incidents (ABIERTO, PENDIENTE, EN_PROGRESO, CERRADO).

### Permissions Required
- Read: `incident-status:read`
- Create: `incident-status:create`
- Update: `incident-status:update`
- Delete: `incident-status:delete`

### Available Functions

```typescript
// Get all incident statuses
getIncidentStatuses(): Promise<IncidentStatus[]>
// Returns: Array of incident statuses with incident count

// Get single incident status by ID
getIncidentStatusById(id: number): Promise<IncidentStatus | null>
// Returns: Incident status with incident count

// Create new incident status
createIncidentStatus(data: IncidentStatusFormData): Promise<{ success: boolean; data: IncidentStatus }>
// Input: { name: string }
// Revalidates: /admin/incident-status

// Update existing incident status
updateIncidentStatus(id: number, data: IncidentStatusFormData): Promise<{ success: boolean; data: IncidentStatus }>
// Input: { name: string }
// Revalidates: /admin/incident-status, /admin/incident-status/{id}

// Delete incident status (soft delete)
deleteIncidentStatus(id: number): Promise<void>
// Validates: Cannot delete if incidents are using this status
// Revalidates: /admin/incident-status
// Redirects: /admin/incident-status
```

### Usage Example
```typescript
import {
  getIncidentStatuses,
  createIncidentStatus,
  updateIncidentStatus,
  deleteIncidentStatus
} from "@/lib/actions/lookups";

// List all incident statuses
const statuses = await getIncidentStatuses();

// Create new status
await createIncidentStatus({ name: "REVISIÓN" });

// Update status
await updateIncidentStatus(1, { name: "EN_REVISION" });

// Delete status (checks for incidents first)
await deleteIncidentStatus(1);
```

---

## Work Activities

**File:** `src/lib/actions/work-activities.ts`

Work activities track individual tasks performed during a work order.

### Permissions Required
- Read: `work-orders:read`
- Create: `work-orders:update`
- Update: `work-orders:update`
- Delete: `work-orders:delete`

### Available Functions

```typescript
// Get all work activities for a work order
getWorkActivities(workOrderId: string): Promise<WorkActivity[]>
// Returns: Array of work activities with work parts

// Get single work activity by ID
getWorkActivityById(id: string): Promise<WorkActivity | null>
// Returns: Work activity with work order, incident, assignedTo, and work parts

// Create new work activity
createWorkActivity(data: WorkActivityFormData): Promise<{ success: boolean; data: WorkActivity }>
// Input: { workOrderId: string; description: string; performedAt?: Date }
// Revalidates: /admin/work-orders/{workOrderId}

// Update existing work activity
updateWorkActivity(id: string, data: Partial<WorkActivityFormData>): Promise<{ success: boolean; data: WorkActivity }>
// Input: { description?: string; performedAt?: Date }
// Revalidates: /admin/work-orders/{workOrderId}

// Delete work activity (soft delete)
deleteWorkActivity(id: string): Promise<{ success: boolean }>
// Revalidates: /admin/work-orders/{workOrderId}, /fsr/work-orders/{workOrderId}
```

### Usage Example
```typescript
import {
  getWorkActivities,
  getWorkActivityById,
  createWorkActivity,
  updateWorkActivity,
  deleteWorkActivity
} from "@/lib/actions/work-activities";

// List activities for a work order
const activities = await getWorkActivities("wo_123");

// Get single activity
const activity = await getWorkActivityById("act_456");

// Create new activity
await createWorkActivity({
  workOrderId: "wo_123",
  description: "Replaced air filter and cleaned system",
  performedAt: new Date()
});

// Update activity
await updateWorkActivity("act_456", {
  description: "Replaced air filter, cleaned system, and tested"
});

// Delete activity
await deleteWorkActivity("act_456");
```

---

## Work Parts

**File:** `src/lib/actions/work-parts.ts`

Work parts track parts/inventory used during work orders and activities.

### Permissions Required
- Read: `work-orders:read` or `parts:read`
- Create: `work-orders:update`
- Update: `work-orders:update`
- Delete: `work-orders:delete`

### Available Functions

```typescript
// Get all work parts for a work order
getWorkParts(workOrderId: string): Promise<WorkPart[]>
// Returns: Array of work parts with part and work activity details

// Get single work part by ID
getWorkPartById(id: string): Promise<WorkPart | null>
// Returns: Work part with part, work order, incident, assignedTo, and work activity

// Create new work part
createWorkPart(data: WorkPartFormData): Promise<{ success: boolean; data: WorkPart }>
// Input: { workOrderId?: string; workActivityId?: string; partId: string; quantity: number; description?: string }
// Validates: Part exists and has sufficient stock
// Side effects: Decrements part stock
// Revalidates: /admin/work-orders/{workOrderId}, /fsr/work-orders/{workOrderId}

// Update existing work part
updateWorkPart(id: string, data: Partial<WorkPartFormData>): Promise<{ success: boolean; data: WorkPart }>
// Input: { quantity?: number; description?: string }
// Validates: Part exists and has sufficient stock for quantity changes
// Side effects: Adjusts part stock based on quantity difference
// Revalidates: /admin/work-orders/{workOrderId}, /fsr/work-orders/{workOrderId}

// Delete work part (soft delete)
deleteWorkPart(id: string): Promise<{ success: boolean }>
// Side effects: Restores part stock
// Revalidates: /admin/work-orders/{workOrderId}, /fsr/work-orders/{workOrderId}

// Get available parts with stock for FSR
getAvailableParts(vicId?: string): Promise<Part[]>
// Returns: Parts with stock > 0, optionally filtered by VIC
// Permission: parts:read
```

### Usage Example
```typescript
import {
  getWorkParts,
  getWorkPartById,
  createWorkPart,
  updateWorkPart,
  deleteWorkPart,
  getAvailableParts
} from "@/lib/actions/work-parts";

// List work parts for a work order
const workParts = await getWorkParts("wo_123");

// Get single work part
const workPart = await getWorkPartById("wp_456");

// Get available parts (FSR use case)
const availableParts = await getAvailableParts("vic_789");

// Create new work part (stock will be decremented)
await createWorkPart({
  workOrderId: "wo_123",
  partId: "part_001",
  quantity: 2,
  description: "Air filter replacement"
});

// Update work part quantity (stock will be adjusted)
await updateWorkPart("wp_456", {
  quantity: 3, // Stock adjusted by difference
  description: "Updated description"
});

// Delete work part (stock will be restored)
await deleteWorkPart("wp_456");
```

---

## States

**File:** `src/lib/actions/lookups.ts:8-96`

States represent Mexican states/regions for VIC locations.

### Permissions Required
- Read: `states:read`
- Create: `states:create`
- Update: `states:update`
- Delete: `states:delete`

### Available Functions

```typescript
// Get all states
getStatesAdmin(): Promise<State[]>
// Returns: Array of states with VIC count

// Get single state by ID
getStateById(id: number): Promise<State | null>
// Returns: State with active VICs

// Create new state
createState(data: StateFormData): Promise<{ success: boolean; data: State }>
// Input: { name: string; code: string }
// Revalidates: /admin/states

// Update existing state
updateState(id: number, data: StateFormData): Promise<{ success: boolean; data: State }>
// Input: { name: string; code: string }
// Revalidates: /admin/states, /admin/states/{id}

// Delete state (soft delete)
deleteState(id: number): Promise<void>
// Validates: Cannot delete if VICs are in this state
// Revalidates: /admin/states
// Redirects: /admin/states
```

### Usage Example
```typescript
import {
  getStatesAdmin,
  getStateById,
  createState,
  updateState,
  deleteState
} from "@/lib/actions/lookups";

// List all states
const states = await getStatesAdmin();

// Get single state with VICs
const state = await getStateById(1);

// Create new state
await createState({
  name: "Jalisco",
  code: "JAL"
});

// Update state
await updateState(1, {
  name: "Ciudad de México",
  code: "CDMX"
});

// Delete state (checks for VICs first)
await deleteState(1);
```

---

## Schedules

**File:** `src/lib/actions/schedules.ts`

Schedules track maintenance and planned activities for VICs.

### Permissions Required
- Read: `schedules:read`
- Create: `schedules:create`
- Update: `schedules:update`
- Delete: `schedules:delete`

### Available Functions

```typescript
// Get all schedules
getSchedules(): Promise<Schedule[]>
// Returns: Array of schedules with VIC and incident count

// Get single schedule by ID
getScheduleById(id: string): Promise<Schedule | null>
// Returns: Schedule with VIC and related incidents

// Create new schedule
createSchedule(data: ScheduleFormData): Promise<{ success: boolean; data: Schedule }>
// Input: { title: string; description?: string; scheduledAt: Date; vicId: string }
// Revalidates: /admin/schedules

// Update existing schedule
updateSchedule(id: string, data: ScheduleFormData): Promise<{ success: boolean; data: Schedule }>
// Input: { title: string; description?: string; scheduledAt: Date; vicId: string }
// Revalidates: /admin/schedules, /admin/schedules/{id}

// Delete schedule (soft delete)
deleteSchedule(id: string): Promise<void>
// Validates: Cannot delete if incidents are linked to this schedule
// Revalidates: /admin/schedules
// Redirects: /admin/schedules

// Get VICs for schedule form
getVICsForSchedules(): Promise<VehicleInspectionCenter[]>
// Returns: Array of active VICs
```

### Usage Example
```typescript
import {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getVICsForSchedules
} from "@/lib/actions/schedules";

// List all schedules
const schedules = await getSchedules();

// Get single schedule with incidents
const schedule = await getScheduleById("sch_123");

// Get VICs for dropdown
const vics = await getVICsForSchedules();

// Create new schedule
await createSchedule({
  title: "Mantenimiento Preventivo Mensual",
  description: "Revisión completa de equipos",
  scheduledAt: new Date("2025-11-01"),
  vicId: "vic_789"
});

// Update schedule
await updateSchedule("sch_123", {
  title: "Mantenimiento Preventivo Semanal",
  description: "Revisión rápida de sistemas críticos",
  scheduledAt: new Date("2025-10-20"),
  vicId: "vic_789"
});

// Delete schedule (checks for incidents first)
await deleteSchedule("sch_123");
```

---

## Common Patterns

### Soft Deletes
All delete operations are soft deletes (set `active: false`). This preserves data integrity and maintains historical records.

```typescript
// Soft delete pattern
await prisma.entity.update({
  where: { id },
  data: { active: false }
});
```

### Validation Before Delete
Most delete operations validate that no child records exist before allowing deletion:

```typescript
// Check for dependencies before delete
const dependentCount = await prisma.childEntity.count({
  where: { parentId: id, active: true }
});

if (dependentCount > 0) {
  throw new Error(`Cannot delete. ${dependentCount} child record(s) exist.`);
}
```

### Revalidation
All mutations (create, update, delete) revalidate affected paths to ensure UI stays in sync:

```typescript
// Revalidate relevant paths
revalidatePath("/admin/entity");
revalidatePath(`/admin/entity/${id}`);
revalidatePath("/fsr/entity"); // For FSR-accessible resources
```

### Stock Management (Work Parts)
Work parts automatically manage inventory stock:

- **Create**: Decrements stock by quantity
- **Update**: Adjusts stock by difference
- **Delete**: Restores stock by quantity

This ensures accurate inventory tracking throughout the work order lifecycle.

---

## Permission Summary

| Entity | Read Permission | Create Permission | Update Permission | Delete Permission |
|--------|----------------|-------------------|-------------------|-------------------|
| User Status | `user-status:read` | `user-status:create` | `user-status:update` | `user-status:delete` |
| Incident Type | `incident-types:read` | `incident-types:create` | `incident-types:update` | `incident-types:delete` |
| Incident Status | `incident-status:read` | `incident-status:create` | `incident-status:update` | `incident-status:delete` |
| Work Activity | `work-orders:read` | `work-orders:update` | `work-orders:update` | `work-orders:delete` |
| Work Part | `work-orders:read` | `work-orders:update` | `work-orders:update` | `work-orders:delete` |
| State | `states:read` | `states:create` | `states:update` | `states:delete` |
| Schedule | `schedules:read` | `schedules:create` | `schedules:update` | `schedules:delete` |

All permissions are seeded in `prisma/seed.ts` and automatically assigned to the ADMINISTRADOR role.

---

## Testing

All CRUD operations can be tested with the admin user:

```
Email: admin@opusinspection.com
Password: password123
```

The admin has full access to all CRUD operations through the database-driven RBAC system.
