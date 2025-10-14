# Incident-Work Order Relationship Documentation

## Overview
This document describes the complete implementation of the one-to-many relationship between Incidents and Work Orders, including all navigation flows and UI enhancements.

## Database Relationship

### Schema Structure
```prisma
model Incident {
  id         Int         @id @default(autoincrement())
  title      String
  // ... other fields
  workOrders WorkOrder[] // One incident can have many work orders
}

model WorkOrder {
  id         String   @id @default(cuid())
  incidentId Int      // Foreign key to parent incident
  incident   Incident @relation(fields: [incidentId], references: [id])
  // ... other fields
}
```

**Relationship**: One Incident → Many Work Orders

## Features Implemented

### 1. Incident Detail Page
**Location**: `/admin/incidents/[id]/page.tsx`

A comprehensive view of an incident showing:

#### Incident Information Section
- **Header**: Title, incident ID, priority badge, status badge
- **Details Card**:
  - Description (full text)
  - Type and priority
  - SLA (Service Level Agreement hours)
  - VIC (Vehicle Inspection Center)
  - Reported by (user name)
  - Reported at (timestamp)
  - Resolved at (if applicable)
  - Schedule information (if linked)

#### Work Orders Section
- **Header**: Shows total count of work orders
- **Create Button**: Quick access to create new work order for this incident
- **Empty State**: Friendly message with call-to-action when no work orders exist
- **Work Orders Table** (when work orders exist):
  - Status badge (color-coded)
  - Assigned FSR name and email
  - Activities count
  - Parts count
  - Created date
  - Finished date
  - Actions: View and Edit buttons

#### Work Order Notes Section
- Aggregates all notes from work orders
- Shows which FSR added each note
- Status at time of note
- Empty state when no notes exist

### 2. Enhanced Work Order Detail Page
**Location**: `/admin/work-orders/[id]/page.tsx`

Added **Parent Incident Card** showing:
- Incident icon
- "Parent Incident" label
- Incident title
- Priority and status summary
- "View Incident" button with external link icon

### 3. Enhanced Work Order Edit Page
**Location**: `/admin/work-orders/[id]/edit/page.tsx`

Added **Parent Incident Card** (same as detail page) showing:
- Quick reference to parent incident
- Link to navigate back to incident detail
- Priority and status context

## Navigation Flows

### Flow 1: Incidents → Work Orders → Back to Incident
```
Incidents List
  → Click "View" on incident
    → Incident Detail Page
      → See all work orders
      → Click "Edit" on work order
        → Work Order Edit Page
          → See parent incident card
          → Click "View Incident"
            → Back to Incident Detail
```

### Flow 2: Create Work Order from Incident
```
Incident Detail Page
  → Click "Create Work Order" button
    → New Work Order Form (pre-filled with incidentId)
      → Submit
        → Redirects to Work Orders list or Incident detail
```

### Flow 3: Work Orders → Parent Incident
```
Work Orders List
  → Click "View" or "Edit" on work order
    → Work Order Detail/Edit Page
      → See parent incident card at top
      → Click "View Incident"
        → Incident Detail Page
```

## UI Components Used

### Cards
- **Incident Details Card**: Shows full incident information
- **Work Orders Table Card**: Lists all related work orders
- **Parent Incident Card**: Highlighted card (muted background) linking to parent

### Badges
- **Priority Badges**: Color-coded (1-4: secondary, 5-7: default, 8-10: destructive)
- **Status Badges**: Different variants for incident/work order status
- **Count Badges**: Outline variant for activities/parts counts

### Buttons
- **Create Work Order**: Primary button on incident detail
- **View/Edit**: Ghost and outline buttons in tables
- **Back Navigation**: Ghost button with ArrowLeft icon
- **View Incident**: Outline button with ExternalLink icon

## Code Locations

### Pages
- `/src/app/admin/incidents/[id]/page.tsx` - Incident detail page (NEW)
- `/src/app/admin/work-orders/[id]/page.tsx` - Work order detail (ENHANCED)
- `/src/app/admin/work-orders/[id]/edit/page.tsx` - Work order edit (ENHANCED)

### Components
- `/src/components/admin/incidents/incidents-table.tsx` - Incidents list table
- `/src/components/admin/work-orders/work-orders-table.tsx` - Work orders list table

### Server Actions
- `/src/lib/actions/incidents.ts` - Incident CRUD operations
  - `getIncidentById()` - Loads incident with work orders (line 53)
- `/src/lib/actions/work-orders.ts` - Work order CRUD operations
  - `getWorkOrderById()` - Loads work order with incident details

## Key Features

### 1. Bidirectional Navigation
Users can easily navigate from:
- Incidents → Work Orders (view all work orders for an incident)
- Work Orders → Incident (view parent incident from work order)

### 2. Contextual Information
- Work order pages always show parent incident context
- Incident pages show complete list of related work orders
- Quick actions available at all levels

### 3. Work Order Management
From incident detail page, users can:
- View all work orders at a glance
- See status and progress of each work order
- Create new work orders instantly
- Navigate to edit work orders
- View aggregated notes from all work orders

### 4. Visual Hierarchy
- Color-coded badges for quick status recognition
- Icons for different entity types (AlertTriangle for incidents, Wrench for work orders)
- Clear sections with separators
- Highlighted parent incident cards on work order pages

## User Roles & Permissions

### Admin
- Full access to incident detail pages
- Can view all work orders for any incident
- Can create, edit, and delete work orders
- Can assign FSRs to work orders

### FSR (Field Service Representative)
- Can view incidents assigned to them
- Can view and edit their own work orders
- Can add activities and parts to work orders
- Can see parent incident context

### Client
- Can view their own incidents
- Limited access to work order information
- Cannot edit work orders

## Database Queries

### Get Incident with Work Orders
```typescript
const incident = await prisma.incident.findUnique({
  where: { id },
  include: {
    type: true,
    status: true,
    vic: true,
    reportedBy: true,
    schedule: true,
    workOrders: {
      where: { active: true },
      include: {
        assignedTo: true,
        _count: {
          select: {
            workActivities: true,
            workParts: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    },
  },
});
```

### Get Work Order with Incident
```typescript
const workOrder = await prisma.workOrder.findUnique({
  where: { id },
  include: {
    incident: {
      include: {
        type: true,
        status: true,
        vic: true,
        reportedBy: true,
      },
    },
    assignedTo: true,
    workActivities: true,
    workParts: true,
    attachments: true,
  },
});
```

## Benefits

### For Admins
- Complete visibility of all work on an incident
- Easy tracking of incident progress through work orders
- Quick access to create and assign work orders
- Centralized view of all FSR activities

### For FSRs
- Clear context of what incident they're working on
- Quick navigation to incident details
- All relevant information in one place
- Easy to understand priority and urgency

### For System
- Clear data relationships
- Consistent navigation patterns
- Reusable components
- Scalable architecture

## Future Enhancements

### Potential Improvements
1. **Timeline View**: Visual timeline showing incident creation and all work order activities
2. **Status Automation**: Auto-update incident status based on work order completion
3. **Notification System**: Alert when work orders are created/completed
4. **Bulk Operations**: Create multiple work orders for an incident
5. **Work Order Templates**: Pre-defined work order types based on incident type
6. **Progress Tracking**: Visual progress bar showing completion percentage
7. **Cost Tracking**: Aggregate parts costs from all work orders
8. **Time Tracking**: Calculate total time spent across all work orders
9. **Reporting**: Generate reports for incidents with multiple work orders
10. **Mobile Optimization**: Enhanced mobile view for FSRs in the field

## Testing Checklist

- [ ] View incident detail page with no work orders
- [ ] View incident detail page with multiple work orders
- [ ] Create work order from incident detail page
- [ ] Navigate from incident to work order edit page
- [ ] Navigate from work order back to incident
- [ ] Verify work order counts are accurate
- [ ] Test all badge colors (priority, status)
- [ ] Verify parent incident card appears on work order pages
- [ ] Test "View Incident" button from work order page
- [ ] Verify work order notes section aggregates correctly
- [ ] Test with different user roles (Admin, FSR, Client)
- [ ] Test on mobile devices
- [ ] Verify loading states
- [ ] Test error handling (non-existent incident/work order)

## Troubleshooting

### Incident Detail Page Not Found (404)
- Verify the page file exists at `/src/app/admin/incidents/[id]/page.tsx`
- Check Next.js is properly detecting the dynamic route
- Restart dev server if needed

### Work Orders Not Showing
- Verify `getIncidentById()` includes `workOrders` in query
- Check work orders have `active: true`
- Ensure work order foreign key `incidentId` matches incident `id`

### Parent Incident Card Not Appearing
- Verify work order query includes incident relation
- Check `workOrder.incident` exists before rendering
- Ensure incident has required fields (title, priority, status)

### Navigation Not Working
- Verify all Link components have correct `href` props
- Check incident/work order IDs are correctly passed
- Ensure routes are properly defined in Next.js app directory

## Related Documentation
- [Work Order Workflow](./WORK_ORDER_WORKFLOW.md) - Work activities and parts management
- [Admin CRUD Implementation](./ADMIN_CRUD_IMPLEMENTATION.md) - General CRUD patterns
- [Quick Start Guide](./QUICK_START_ADMIN.md) - Getting started with admin features
