# Edit Functionality Documentation

## Overview
Complete inline editing capabilities for Work Orders, Work Activities, and Work Parts. Users can modify all details directly from the work order edit page with real-time validation and stock management.

## Features Implemented

### 1. Work Order Editing
**Component**: `/src/components/work-orders/work-order-edit-form.tsx`

#### Editable Fields:
- **Assigned To**: Dropdown of all FSR users
- **Status**: PENDIENTE, EN_PROGRESO, COMPLETADO, CANCELADO
- **Notes**: Freeform textarea for additional information

#### UI Behavior:
- Initially shows read-only view with "Edit" button
- Click "Edit" → Fields become editable
- Save/Cancel buttons appear
- On save: Updates database, refreshes data, returns to read-only view
- On cancel: Discards changes, returns to read-only view

#### Server Action:
`updateWorkOrder()` at `src/lib/actions/work-orders.ts:138`
- Updates assignment, status, and notes
- Revalidates paths for work orders and parent incident
- Returns success status

### 2. Work Activity Editing
**Component**: `/src/components/work-orders/work-activity-edit.tsx`

#### Editable Fields:
- **Performed At**: Date and time picker (datetime-local input)
- **Description**: Textarea for work description

#### UI Behavior:
- Initially shows activity with date/time and description
- Small "Edit" button (pencil icon) on right
- Click edit → Inline form appears in same card
- Save/Cancel buttons at bottom
- On save: Updates activity, refreshes page data
- Validation: Description required

#### Server Action:
`updateWorkActivity()` at `src/lib/actions/work-activities.ts:89`
- Updates description and performedAt timestamp
- Revalidates work order path
- Returns success status

#### Limitations:
- Cannot edit attached files (must delete activity and recreate)
- Cannot change work order assignment (delete and recreate instead)

### 3. Work Part Editing
**Component**: `/src/components/work-orders/work-part-edit.tsx`

#### Editable Fields:
- **Quantity**: Number input with min/max validation
- **Description**: Notes about part usage

#### UI Behavior:
- Initially shows part name, quantity, price, total
- "Edit" button on right side
- Click edit → Inline form expands in place
- Shows available stock calculation
- Real-time total cost calculation
- Save/Cancel buttons

#### Stock Management:
```
Available Stock = Current Part Stock + Currently Used Quantity
Max Quantity = Available Stock
```

**Example**:
- Part has 10 in stock
- Work part currently uses 3
- Available for editing: 10 + 3 = 13
- Can adjust from 1 to 13
- If change to 5: Stock becomes 10 - (5 - 3) = 8

#### Server Action:
`updateWorkPart()` at `src/lib/actions/work-parts.ts:113`
- Validates new quantity against available stock
- Calculates stock difference
- Updates part stock automatically
- Updates work part quantity and description
- Returns success status

#### Validation:
- Quantity must be > 0
- Quantity cannot exceed available stock
- Shows clear error messages
- Prevents save if validation fails

## User Workflows

### Editing Work Order Details

```
1. Navigate to Work Order Edit Page
2. See "Work Order Details" card
3. Click "Edit" button
4. Modify:
   - Change assigned FSR
   - Update status
   - Add/edit notes
5. Click "Save Changes"
6. Card returns to read-only view with updated data
```

### Editing Work Activity

```
1. In Work Activities section
2. Find activity to edit
3. Click pencil icon (Edit button)
4. Activity card expands with form
5. Modify:
   - Change date/time
   - Edit description
6. Click "Save Changes"
7. Activity updates and form collapses
```

### Editing Work Part

```
1. In Parts Used section
2. Find part to edit
3. Click pencil icon (Edit button)
4. Part row expands with form
5. See available stock info
6. Modify:
   - Adjust quantity (within stock limits)
   - Edit notes
7. See real-time total cost update
8. Click "Save Changes"
9. Stock automatically adjusted
10. Part returns to normal view
```

## Technical Implementation

### State Management

Each edit component manages its own state:
- `isEditing`: Boolean for view/edit mode
- `loading`: Boolean for save operation
- `error`: String for error messages
- `formData`: Object with current field values

### Edit Pattern

**Inline Toggle Pattern**:
```typescript
const [isEditing, setIsEditing] = useState(false);

if (!isEditing) {
  return <ReadOnlyView onEdit={() => setIsEditing(true)} />;
}

return <EditForm onSave={handleSave} onCancel={handleCancel} />;
```

### Data Flow

```
User clicks Edit
  → Component enters edit mode (isEditing = true)
  → Form fields populated with current data
  → User modifies fields
  → User clicks Save
  → Validation runs
  → Server action called
  → Database updated
  → Parent component refreshed (fetchData())
  → Component exits edit mode (isEditing = false)
```

### Error Handling

All components handle errors gracefully:
1. Client-side validation before save
2. Try-catch around server actions
3. Display FormError component with message
4. Don't change edit mode on error
5. User can correct and retry

### Stock Management Logic

**For Work Parts**:

1. **Calculate Available**:
   ```typescript
   const availableStock = part.stock + workPart.quantity;
   ```

2. **Validate New Quantity**:
   ```typescript
   if (newQuantity > availableStock) {
     throw new Error("Insufficient stock");
   }
   ```

3. **Update Stock**:
   ```typescript
   const difference = newQuantity - oldQuantity;
   await prisma.part.update({
     where: { id: partId },
     data: { stock: { decrement: difference } }
   });
   ```

**Examples**:
- Old: 3, New: 5, Difference: +2 → Decrement stock by 2
- Old: 5, New: 3, Difference: -2 → Decrement stock by -2 (increases stock)
- Old: 3, New: 3, Difference: 0 → No stock change

## Components Created

### 1. WorkOrderEditForm
**File**: `/src/components/work-orders/work-order-edit-form.tsx`
**Props**:
```typescript
{
  workOrder: {
    id: string;
    status: string;
    assignedToId: string;
    notes: string | null;
    assignedTo: { id: string; name: string };
  };
  users: Array<{ id: string; name: string; email: string }>;
  onSuccess?: () => void;
}
```

### 2. WorkActivityEdit
**File**: `/src/components/work-orders/work-activity-edit.tsx`
**Props**:
```typescript
{
  activity: {
    id: string;
    description: string;
    performedAt: Date;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}
```

### 3. WorkPartEdit
**File**: `/src/components/work-orders/work-part-edit.tsx`
**Props**:
```typescript
{
  workPart: {
    id: string;
    quantity: number;
    description: string | null;
    price: number;
    part: {
      id: string;
      name: string;
      stock: number;
    };
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}
```

## Page Updates

### Work Order Edit Page
**File**: `/src/app/admin/work-orders/[id]/edit/page.tsx`

**Changes**:
1. Replaced read-only Work Order Details card with `WorkOrderEditForm`
2. Updated activities list to use `WorkActivityEdit` component
3. Updated parts list to use `WorkPartEdit` component
4. Added fetch for available users from `getWorkOrderFormOptions()`
5. All sections now support inline editing

**Data Fetching**:
```typescript
const [woData, activitiesData, partsData, availablePartsData, formOptions] =
  await Promise.all([
    getWorkOrderById(workOrderId),
    getWorkActivities(workOrderId),
    getWorkParts(workOrderId),
    getParts(),
    getWorkOrderFormOptions(), // NEW - for user dropdown
  ]);
```

## Validation Rules

### Work Order
- ✅ Assigned To: Required, must be valid user
- ✅ Status: Required, must be one of: PENDIENTE, EN_PROGRESO, COMPLETADO, CANCELADO
- ✅ Notes: Optional, freeform text

### Work Activity
- ✅ Description: Required, cannot be empty
- ✅ Performed At: Required, valid datetime

### Work Part
- ✅ Quantity: Required, must be > 0
- ✅ Quantity: Cannot exceed available stock
- ✅ Description: Optional

## Security & Permissions

All edit operations require:
- `work-orders:update` permission

Permission checks in server actions:
```typescript
await requirePermission("work-orders:update");
```

Roles with permission:
- **ADMINISTRADOR**: Full access
- **FSR**: Can edit their own work orders
- **CLIENT**: No edit access
- **GUEST**: No edit access

## Error Messages

### Work Order
- "Failed to update work order" - Generic save error

### Work Activity
- "Description is required" - Empty description
- "Failed to update activity" - Generic save error

### Work Part
- "Quantity must be greater than 0" - Invalid quantity
- "Insufficient stock. Maximum available: {X}" - Stock validation failed
- "Work part no encontrada" - Work part not found
- "Parte no encontrada" - Part not found
- "Failed to update part" - Generic save error

## User Experience

### Visual Feedback
1. **Edit Buttons**: Pencil icon, subtle, positioned on right
2. **Edit Mode**: Form fields with clear labels and placeholders
3. **Loading**: "Saving..." text replaces button label
4. **Success**: Component refreshes with new data
5. **Error**: Red FormError component with clear message

### Keyboard Navigation
- Tab through form fields
- Enter to save (on single-line inputs)
- Escape to cancel (via Cancel button)

### Mobile Support
- Responsive layouts
- Touch-friendly buttons
- Inline forms work on small screens
- Date/time picker uses native mobile inputs

## Testing Checklist

### Work Order Editing
- [ ] Edit assigned FSR and save
- [ ] Change status and save
- [ ] Add notes and save
- [ ] Edit notes and save
- [ ] Cancel edit (verify no changes saved)
- [ ] Try to save with validation errors

### Work Activity Editing
- [ ] Edit description and save
- [ ] Change performed date/time and save
- [ ] Clear description (should show error)
- [ ] Cancel edit (verify original values restored)
- [ ] Edit activity with linked parts (verify parts unaffected)

### Work Part Editing
- [ ] Increase quantity (verify stock decreased)
- [ ] Decrease quantity (verify stock increased)
- [ ] Set quantity to 0 (should show error)
- [ ] Try to exceed available stock (should show error)
- [ ] Edit description and save
- [ ] Cancel edit (verify stock unchanged)
- [ ] Verify total cost calculation updates in real-time

### Integration Testing
- [ ] Edit work order, then edit activity
- [ ] Edit work order, then edit part
- [ ] Edit multiple activities in sequence
- [ ] Edit multiple parts in sequence
- [ ] Delete and edit operations together
- [ ] Verify all edits reflect in parent incident view

### Permission Testing
- [ ] Admin can edit all fields
- [ ] FSR can edit their work orders
- [ ] FSR cannot edit others' work orders
- [ ] Client cannot access edit functionality

## Troubleshooting

### Changes Not Saving
1. Check browser console for errors
2. Verify user has `work-orders:update` permission
3. Check network tab for failed API calls
4. Verify server action is being called correctly

### Stock Not Updating
1. Check part exists in database
2. Verify stock calculation logic
3. Review difference calculation: `newQuantity - oldQuantity`
4. Ensure transaction completes successfully

### Form Not Entering Edit Mode
1. Check `isEditing` state is being set
2. Verify Edit button onClick handler
3. Check for JavaScript errors preventing state update

### Data Not Refreshing After Save
1. Verify `onSuccess` callback is being called
2. Check `fetchData()` is re-fetching all data
3. Ensure `revalidatePath()` is called in server action

## Future Enhancements

1. **Bulk Editing**: Select multiple items and edit at once
2. **Edit History**: Track all changes with timestamps
3. **Undo/Redo**: Revert recent changes
4. **Auto-save**: Save changes automatically as user types
5. **Conflict Resolution**: Handle concurrent edits by multiple users
6. **Field-level Permissions**: Restrict editing of specific fields by role
7. **Audit Trail**: Log all edits for compliance
8. **Rich Text Editor**: For longer descriptions with formatting
9. **Inline Validation**: Real-time validation as user types
10. **Keyboard Shortcuts**: Ctrl+S to save, Ctrl+E to edit

## Related Documentation
- [Work Order Workflow](./WORK_ORDER_WORKFLOW.md) - Complete workflow documentation
- [Incident-Work Order Relationship](./INCIDENT_WORK_ORDER_RELATIONSHIP.md) - Entity relationships
- [Admin CRUD Implementation](./ADMIN_CRUD_IMPLEMENTATION.md) - General CRUD patterns
