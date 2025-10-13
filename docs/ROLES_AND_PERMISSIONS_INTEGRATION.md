# Roles and Permissions Integration - Complete Guide

## Overview

This document describes the complete integration of the role-based access control (RBAC) system in OpusTrack, including all role-specific functionalities and workflows.

## Role Structure

### 1. ADMINISTRADOR (Administrator)
**Default Path:** `/admin`

**Key Responsibilities:**
- Full system access to all resources
- Assign FSR users to work orders
- Change incident status
- Manage all system entities (users, roles, VICs, etc.)

**Permissions:**
- ALL permissions in the system (automatically granted)

**Key Actions:**
```typescript
// Assign FSR to incident (creates work order automatically)
import { assignIncidentToFSR } from "@/lib/actions/incidents";
await assignIncidentToFSR(incidentId, fsrUserId);

// Change incident status
import { changeIncidentStatus } from "@/lib/actions/incidents";
await changeIncidentStatus(incidentId, statusId);

// Get list of FSR users for assignment
import { getFSRUsers } from "@/lib/actions/incidents";
const fsrUsers = await getFSRUsers();
```

**Workflow:**
1. Client raises an incident
2. Admin reviews the incident
3. Admin assigns the incident to an FSR user (automatically creates work order with "PENDIENTE" status)
4. Admin can change incident status at any time
5. Admin monitors overall system and work order progress

---

### 2. FSR (Field Service Representative)
**Default Path:** `/fsr`

**Key Responsibilities:**
- Complete assigned work orders
- Add work activities to work orders
- Add work parts to work orders/activities
- Update work order progress

**Permissions:**
- `route:fsr`
- `incidents:read`, `incidents:update`
- `work-orders:read`, `work-orders:update`, `work-orders:complete`
- `work-activities:read`, `work-activities:create`, `work-activities:update`, `work-activities:complete`
- `work-parts:read`, `work-parts:create`, `work-parts:update`
- `parts:read`
- `schedules:read`
- `users:read`
- `vics:read`
- `reports:view`, `reports:export`

**Key Actions:**
```typescript
// Get work orders assigned to current FSR
import { getMyWorkOrders } from "@/lib/actions/work-orders";
const myWorkOrders = await getMyWorkOrders();

// Start a work order
import { startWorkOrder } from "@/lib/actions/work-orders";
await startWorkOrder(workOrderId);

// Add work activity
import { createWorkActivity } from "@/lib/actions/work-activities";
await createWorkActivity({
  workOrderId: "...",
  description: "Installed new air filter",
  performedAt: new Date()
});

// Add work part
import { createWorkPart } from "@/lib/actions/work-parts";
await createWorkPart({
  workOrderId: "...",
  partId: "...",
  quantity: 2,
  description: "Air filter replacement"
});

// Complete work order
import { completeWorkOrder } from "@/lib/actions/work-orders";
await completeWorkOrder(workOrderId, "Work completed successfully");

// Get available parts
import { getAvailableParts } from "@/lib/actions/work-parts";
const parts = await getAvailableParts(vicId);
```

**Workflow:**
1. FSR receives work order assignment from admin
2. FSR starts the work order (status: "PENDIENTE" → "EN_PROGRESO")
3. FSR performs work and logs activities
4. FSR adds parts used during work activities
5. FSR completes the work order (status: "EN_PROGRESO" → "COMPLETADA")
6. When all work orders for an incident are completed, incident status automatically changes to "CERRADO"

---

### 3. CLIENT
**Default Path:** `/client`

**Key Responsibilities:**
- Raise incidents for their VIC
- View incidents from their VIC
- View work order progress

**Permissions:**
- `route:client`
- `incidents:read`, `incidents:create`
- `work-orders:read`
- `schedules:read`

**Key Actions:**
```typescript
// Create incident as client (simplified)
import { createIncidentAsClient } from "@/lib/actions/incidents";
await createIncidentAsClient(
  "Equipment malfunction",
  "Line 2 emission system not working",
  8, // priority
  typeId // optional
);

// Get incidents for client's VIC
import { getClientIncidents } from "@/lib/actions/incidents";
const incidents = await getClientIncidents();
```

**Workflow:**
1. Client experiences an issue at their VIC
2. Client raises an incident with title, description, and priority
3. Incident is automatically set to "ABIERTO" status
4. Incident is linked to client's VIC
5. Client can view incident progress and assigned work orders

**Note:** Clients must have a VIC assigned (`vicId` in User model) to create incidents.

---

### 4. GUEST
**Default Path:** `/guest`

**Key Responsibilities:**
- Read-only access to view system data

**Permissions:**
- `route:guest`
- `incidents:read`
- `work-orders:read`
- `parts:read`
- `schedules:read`

**Note:** Guest role has no create, update, or delete permissions. Suitable for stakeholders who need visibility without modification rights.

---

## Complete Workflow Example

### Scenario: Equipment Failure at VIC

**Step 1: Client Raises Incident**
```typescript
// Client (client@opusinspection.com) logs in
// Client navigates to /client/incidents/new

await createIncidentAsClient(
  "Emission system failure on Line 2",
  "The emissions measurement equipment is showing error codes",
  9, // high priority
  1  // REPARACION type
);
// Status: ABIERTO
// VIC: Automatically set to client's VIC
```

**Step 2: Admin Reviews and Assigns**
```typescript
// Admin (admin@opusinspection.com) logs in
// Admin navigates to /admin/incidents

// Get list of FSR users
const fsrUsers = await getFSRUsers();

// Assign to FSR
await assignIncidentToFSR(incidentId, fsrUsers[0].id);
// Creates work order with status: PENDIENTE
// Changes incident status: ABIERTO → EN_PROGRESO
```

**Step 3: FSR Works on Issue**
```typescript
// FSR (fsr@opusinspection.com) logs in
// FSR navigates to /fsr/work-orders

// Get assigned work orders
const myWorkOrders = await getMyWorkOrders();

// Start work
await startWorkOrder(workOrderId);
// Status: PENDIENTE → EN_PROGRESO

// Log activity
await createWorkActivity({
  workOrderId,
  description: "Diagnosed sensor malfunction",
  performedAt: new Date()
});

// Add parts used
await createWorkPart({
  workOrderId,
  partId: "...", // Air filter
  quantity: 1,
  description: "Replaced emission sensor"
});

// Complete work order
await completeWorkOrder(workOrderId, "Sensor replaced, system tested OK");
// Status: EN_PROGRESO → COMPLETADA
// Incident status: EN_PROGRESO → CERRADO (if all work orders complete)
```

**Step 4: Client Views Resolution**
```typescript
// Client checks incident status
const incidents = await getClientIncidents();
// Can see incident is now CERRADO with completed work orders
```

---

## New Permissions Added

The following permissions were added to the seed file:

### Work Order Permissions
- `work-orders:complete` - Complete work orders (FSR)

### Work Activity Permissions
- `work-activities:read` - View work activities
- `work-activities:create` - Create work activities (FSR)
- `work-activities:update` - Update work activities (FSR)
- `work-activities:delete` - Delete work activities
- `work-activities:complete` - Complete work activities (FSR)

### Work Part Permissions
- `work-parts:read` - View work parts
- `work-parts:create` - Create work parts (FSR)
- `work-parts:update` - Update work parts (FSR)
- `work-parts:delete` - Delete work parts

---

## New Server Actions

### Incidents (`src/lib/actions/incidents.ts`)
- `changeIncidentStatus(id, statusId)` - Admin changes incident status
- `assignIncidentToFSR(incidentId, fsrUserId)` - Admin assigns incident to FSR (creates work order)
- `getFSRUsers()` - Get list of FSR users for assignment
- `createIncidentAsClient(title, description, priority, typeId?)` - Simplified incident creation for clients
- `getClientIncidents()` - Get incidents for client's VIC only

### Work Orders (`src/lib/actions/work-orders.ts`)
- `completeWorkOrder(id, notes?)` - FSR completes work order
- `startWorkOrder(id)` - FSR starts work order
- `getMyWorkOrders()` - Get work orders assigned to current user (FSR)

### Work Activities (`src/lib/actions/work-activities.ts`)
- `getWorkActivityById(id)` - Get single work activity with details

### Work Parts (`src/lib/actions/work-parts.ts`)
- `getAvailableParts(vicId?)` - Get parts with available stock for FSR

---

## Status Transitions

### Incident Status Flow
```
ABIERTO (Client creates)
  ↓
EN_PROGRESO (Admin assigns FSR)
  ↓
CERRADO (All work orders completed OR Admin manually closes)
```

### Work Order Status Flow
```
PENDIENTE (Created by admin)
  ↓
EN_PROGRESO (FSR starts work)
  ↓
COMPLETADA (FSR completes work)
```

---

## Important Notes

1. **Admin has full access** - The ADMINISTRADOR role automatically has access to all routes and permissions without explicit assignment.

2. **Client VIC requirement** - Clients must have a VIC assigned to create incidents. The incident is automatically linked to their VIC.

3. **Automatic incident closure** - When all work orders for an incident are marked as "COMPLETADA", the incident automatically changes to "CERRADO" status.

4. **Stock management** - When FSR adds work parts, the part stock is automatically decremented. When work parts are deleted, stock is restored.

5. **Permission caching** - Permissions are cached for 5 minutes. If you update permissions in the database, call `clearPermissionsCache()` from `src/lib/authz/authz.ts`.

6. **Revalidation paths** - All actions revalidate both admin and role-specific paths (e.g., `/admin/work-orders` and `/fsr/work-orders`) to ensure UI stays in sync.

---

## Testing

### Test Credentials
```
Admin:  admin@opusinspection.com / password123
FSR:    fsr@opusinspection.com / password123
Client: client@opusinspection.com / password123
Guest:  guest@opusinspection.com / password123
```

### Test Workflow
1. Login as client → Create incident
2. Login as admin → Assign incident to FSR
3. Login as FSR → Start work order, add activities/parts, complete work order
4. Login as client → Verify incident is closed

---

## File References

- **Seed file:** `prisma/seed.ts:50-110` (permissions), `prisma/seed.ts:130-177` (roles)
- **Incident actions:** `src/lib/actions/incidents.ts`
- **Work order actions:** `src/lib/actions/work-orders.ts`
- **Work activity actions:** `src/lib/actions/work-activities.ts`
- **Work part actions:** `src/lib/actions/work-parts.ts`
- **Auth helpers:** `src/lib/auth/auth.ts`
- **Authorization lib:** `src/lib/authz/authz.ts`
- **Middleware:** `src/middleware.ts`
