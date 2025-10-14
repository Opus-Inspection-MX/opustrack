# Work Order Edit Workflow Documentation

## Overview
This document describes the complete workflow for editing work orders, including managing work activities, parts, and file attachments with camera support.

## Features Implemented

### 1. Enhanced Work Order Edit Page
**Location**: `/admin/work-orders/[id]/edit`

The edit page now provides a comprehensive interface for managing all aspects of a work order:

- **Work Order Details**: View basic information (assigned user, status, dates, notes)
- **Work Activities**: Add and manage work activities with descriptions and file attachments
- **Parts Management**: Track parts used with automatic stock management
- **File Attachments**: Upload photos, videos, and documents with camera support on mobile

### 2. Work Activities

#### Adding a Work Activity
1. Click "Add Activity" button
2. Enter a detailed description of the work performed
3. Optionally upload evidence files (photos, videos, PDFs)
   - **Desktop**: Choose files from computer
   - **Mobile**: Use camera to take photos directly
4. Click "Save Activity"

**Features**:
- Rich text description (required)
- Multiple file uploads (up to 10 files, 10MB each)
- Camera integration for mobile devices
- Automatic timestamp on creation
- Files are linked to the work order

**Server Action**: `createWorkActivity()` at `src/lib/actions/work-activities.ts:71`

### 3. Parts Management

#### Adding Parts to Work Order
1. Click "Add Part" button
2. Select a part from the dropdown (shows name, price, and available stock)
3. Enter quantity (validated against available stock)
4. Optionally add notes about the part usage
5. Click "Add Part"

**Features**:
- Real-time stock validation
- Automatic price capture at time of use
- Total cost calculation
- Stock automatically decremented when part is added
- Stock automatically restored when part is removed

**Server Action**: `createWorkPart()` at `src/lib/actions/work-parts.ts:67`

### 4. File Upload System

#### File Upload Component
**Location**: `src/components/ui/file-upload.tsx`

**Capabilities**:
- Multiple file selection
- Direct camera capture on mobile devices
- File type validation (images, videos, PDFs)
- File size validation (configurable, default 10MB)
- Visual file preview with icons
- Drag-and-drop support (future enhancement)

**Supported File Types**:
- Images: JPEG, PNG, GIF, WebP
- Videos: MP4, QuickTime
- Documents: PDF

#### Camera Support
On mobile devices, clicking "Take Photo" activates the device camera using the HTML5 `capture="environment"` attribute, which:
- Opens the rear camera by default
- Allows taking photos directly
- Saves photos to the work order

#### File Storage
- Files are stored in `/public/uploads/work-orders/`
- Filenames are sanitized and timestamped to prevent conflicts
- Database stores metadata (filename, path, size, mimetype, description)
- Files can be viewed by clicking on them in the attachments list

**Server Actions**:
- Upload: `uploadWorkOrderAttachment()` at `src/lib/actions/work-orders.ts:334`
- Delete: `deleteWorkOrderAttachment()` at `src/lib/actions/work-orders.ts:387`

## Database Schema

### WorkActivity Model
```prisma
model WorkActivity {
  id          String     @id @default(cuid())
  workOrderId String
  workOrder   WorkOrder  @relation(fields: [workOrderId], references: [id])
  description String
  performedAt DateTime   @default(now())
  workParts   WorkPart[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  active      Boolean    @default(true)
}
```

### WorkOrderAttachment Model
```prisma
model WorkOrderAttachment {
  id          String    @id @default(cuid())
  workOrderId String
  workOrder   WorkOrder @relation(fields: [workOrderId], references: [id])
  filename    String
  filepath    String
  mimetype    String
  size        Int
  description String?
  uploadedAt  DateTime  @default(now())
  active      Boolean   @default(true)
}
```

### WorkPart Model
```prisma
model WorkPart {
  id             String        @id @default(cuid())
  partId         String
  part           Part          @relation(fields: [partId], references: [id])
  quantity       Int
  description    String?
  price          Float         // Price at time of use
  workOrderId    String?
  workOrder      WorkOrder?    @relation(fields: [workOrderId], references: [id])
  workActivityId String?
  workActivity   WorkActivity? @relation(fields: [workActivityId], references: [id])
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  active         Boolean       @default(true)
}
```

## User Flow

### FSR (Field Service Representative) Workflow
1. Navigate to work order from dashboard
2. Click "Edit" to open work order edit page
3. Review work order details
4. **Add Work Activities**:
   - Click "Add Activity"
   - Describe work performed
   - Take photos of work (mobile) or upload files (desktop)
   - Save activity
5. **Record Parts Used**:
   - Click "Add Part"
   - Select part from inventory
   - Enter quantity used
   - Add notes if needed
   - Save part (stock automatically updated)
6. Repeat steps 4-5 as needed
7. When all work is complete, mark work order as complete

### Admin Workflow
1. Assign work order to FSR
2. Monitor progress through work activities
3. Review parts usage and costs
4. Verify attachments (photos/videos of completed work)
5. Close work order when satisfied

## Technical Implementation

### Components Created

1. **FileUpload Component** (`src/components/ui/file-upload.tsx`)
   - Reusable file upload component
   - Camera support for mobile
   - File validation and preview

2. **WorkActivityForm Component** (`src/components/work-orders/work-activity-form.tsx`)
   - Form for adding work activities
   - Integrated file upload
   - Description textarea

3. **WorkPartForm Component** (`src/components/work-orders/work-part-form.tsx`)
   - Form for adding parts
   - Part selection with stock info
   - Quantity validation
   - Cost calculation

### Utilities Created

**File Upload Utility** (`src/lib/upload.ts`):
- `fileToBase64()` - Convert File to base64 for server upload
- `validateFile()` - Validate file size and type
- `formatFileSize()` - Format bytes to human-readable
- `getFileIcon()` - Get emoji icon for file type

### Server Actions Enhanced

**Work Orders** (`src/lib/actions/work-orders.ts`):
- `uploadWorkOrderAttachment()` - Upload and save files
- `deleteWorkOrderAttachment()` - Soft delete attachments

**Work Activities** (`src/lib/actions/work-activities.ts`):
- `createWorkActivity()` - Create work activity record
- `getWorkActivities()` - Get activities for work order
- `deleteWorkActivity()` - Soft delete activity

**Work Parts** (`src/lib/actions/work-parts.ts`):
- `createWorkPart()` - Add part with stock management
- `getWorkParts()` - Get parts for work order
- `deleteWorkPart()` - Remove part and restore stock

## Security Considerations

1. **File Upload Security**:
   - File type validation on client and server
   - File size limits enforced
   - Filenames sanitized to prevent path traversal
   - Files stored outside of executable directories

2. **Permission Checks**:
   - All actions require `work-orders:update` permission
   - FSR role has appropriate permissions
   - Admin has full access

3. **Data Validation**:
   - Stock validation before part usage
   - Required fields enforced
   - Input sanitization on server

## Future Enhancements

1. **Drag-and-drop file upload**
2. **Image compression before upload**
3. **Video thumbnail generation**
4. **Batch file upload**
5. **File search and filtering**
6. **Activity templates for common tasks**
7. **Parts suggestions based on incident type**
8. **Mobile app integration**

## Testing Checklist

- [ ] Upload image from desktop
- [ ] Take photo with mobile camera
- [ ] Upload PDF document
- [ ] Upload video file
- [ ] Test file size limit (try >10MB file)
- [ ] Test invalid file type
- [ ] Add work activity with multiple files
- [ ] Add part with stock validation
- [ ] Try adding part with insufficient stock
- [ ] Delete work activity (verify files remain)
- [ ] Delete attachment
- [ ] Delete part (verify stock restored)
- [ ] View work order with all sections populated
- [ ] Test on mobile device with camera
- [ ] Test permissions (FSR vs Admin)

## Troubleshooting

### Files Not Uploading
1. Check `/public/uploads/work-orders/` directory exists and is writable
2. Verify file size is under 10MB
3. Check browser console for errors
4. Verify server has write permissions

### Camera Not Working on Mobile
1. Ensure HTTPS is enabled (required for camera access)
2. Check browser permissions for camera
3. Try different mobile browser
4. Verify `capture="environment"` attribute is present

### Stock Not Updating
1. Verify part exists in database
2. Check stock quantity before operation
3. Review server logs for errors
4. Ensure transaction completed successfully

## API Reference

### Upload File
```typescript
await uploadWorkOrderAttachment(workOrderId, {
  filename: "photo.jpg",
  base64Data: "data:image/jpeg;base64,...",
  mimetype: "image/jpeg",
  size: 102400,
  description: "Optional description"
});
```

### Create Work Activity
```typescript
await createWorkActivity({
  workOrderId: "wo_123",
  description: "Replaced brake pads and rotors",
  performedAt: new Date()
});
```

### Add Work Part
```typescript
await createWorkPart({
  workOrderId: "wo_123",
  partId: "part_456",
  quantity: 2,
  description: "Front brake pads"
});
```

## File Structure
```
src/
├── app/admin/work-orders/[id]/edit/
│   └── page.tsx                          # Enhanced edit page
├── components/
│   ├── ui/
│   │   └── file-upload.tsx              # File upload component
│   └── work-orders/
│       ├── work-activity-form.tsx       # Activity form
│       └── work-part-form.tsx           # Parts form
├── lib/
│   ├── upload.ts                        # Upload utilities
│   └── actions/
│       ├── work-orders.ts               # File upload actions
│       ├── work-activities.ts           # Activity actions
│       └── work-parts.ts                # Parts actions
└── public/uploads/work-orders/          # File storage directory
```
