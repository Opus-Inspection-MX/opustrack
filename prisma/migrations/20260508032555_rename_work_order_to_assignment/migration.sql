-- Rename Work Order entities to Assignment entities.
-- Preserves all data via in-place ALTER TABLE / RENAME operations.

-- ============================================================================
-- 1. RENAME TABLES
-- ============================================================================
ALTER TABLE "public"."WorkOrder" RENAME TO "Assignment";
ALTER TABLE "public"."WorkOrderStatus" RENAME TO "AssignmentStatus";
ALTER TABLE "public"."WorkActivity" RENAME TO "AssignmentActivity";
ALTER TABLE "public"."WorkOrderAttachment" RENAME TO "AssignmentAttachment";

-- ============================================================================
-- 2. RENAME FOREIGN-KEY COLUMNS
-- ============================================================================
ALTER TABLE "public"."AssignmentActivity" RENAME COLUMN "workOrderId" TO "assignmentId";
ALTER TABLE "public"."AssignmentAttachment" RENAME COLUMN "workOrderId" TO "assignmentId";
ALTER TABLE "public"."WorkPart" RENAME COLUMN "workOrderId" TO "assignmentId";
ALTER TABLE "public"."WorkPart" RENAME COLUMN "workActivityId" TO "activityId";
ALTER TABLE "public"."VehicleTrip" RENAME COLUMN "workOrderId" TO "assignmentId";

-- ============================================================================
-- 3. RENAME INDEXES
-- ============================================================================
ALTER INDEX "public"."WorkOrder_pkey" RENAME TO "Assignment_pkey";
ALTER INDEX "public"."WorkOrder_incidentId_idx" RENAME TO "Assignment_incidentId_idx";
ALTER INDEX "public"."WorkOrder_assignedToId_idx" RENAME TO "Assignment_assignedToId_idx";
ALTER INDEX "public"."WorkOrder_statusId_idx" RENAME TO "Assignment_statusId_idx";
ALTER INDEX "public"."WorkOrder_folio_idx" RENAME TO "Assignment_folio_idx";
ALTER INDEX "public"."WorkOrder_active_assignedToId_idx" RENAME TO "Assignment_active_assignedToId_idx";
ALTER INDEX "public"."WorkOrder_active_createdAt_idx" RENAME TO "Assignment_active_createdAt_idx";
ALTER INDEX "public"."WorkOrder_unlockedAt_idx" RENAME TO "Assignment_unlockedAt_idx";

ALTER INDEX "public"."WorkOrderStatus_pkey" RENAME TO "AssignmentStatus_pkey";
ALTER INDEX "public"."WorkOrderStatus_name_key" RENAME TO "AssignmentStatus_name_key";

ALTER INDEX "public"."WorkActivity_pkey" RENAME TO "AssignmentActivity_pkey";
ALTER INDEX "public"."WorkActivity_workOrderId_idx" RENAME TO "AssignmentActivity_assignmentId_idx";

ALTER INDEX "public"."WorkOrderAttachment_pkey" RENAME TO "AssignmentAttachment_pkey";
ALTER INDEX "public"."WorkOrderAttachment_workOrderId_idx" RENAME TO "AssignmentAttachment_assignmentId_idx";

ALTER INDEX "public"."WorkPart_workOrderId_idx" RENAME TO "WorkPart_assignmentId_idx";
ALTER INDEX "public"."WorkPart_workActivityId_idx" RENAME TO "WorkPart_activityId_idx";

ALTER INDEX "public"."VehicleTrip_workOrderId_idx" RENAME TO "VehicleTrip_assignmentId_idx";

-- ============================================================================
-- 4. RENAME FOREIGN-KEY CONSTRAINTS
-- ============================================================================
ALTER TABLE "public"."Assignment" RENAME CONSTRAINT "WorkOrder_incidentId_fkey" TO "Assignment_incidentId_fkey";
ALTER TABLE "public"."Assignment" RENAME CONSTRAINT "WorkOrder_assignedToId_fkey" TO "Assignment_assignedToId_fkey";
ALTER TABLE "public"."Assignment" RENAME CONSTRAINT "WorkOrder_statusId_fkey" TO "Assignment_statusId_fkey";
ALTER TABLE "public"."AssignmentActivity" RENAME CONSTRAINT "WorkActivity_workOrderId_fkey" TO "AssignmentActivity_assignmentId_fkey";
ALTER TABLE "public"."AssignmentAttachment" RENAME CONSTRAINT "WorkOrderAttachment_workOrderId_fkey" TO "AssignmentAttachment_assignmentId_fkey";
ALTER TABLE "public"."WorkPart" RENAME CONSTRAINT "WorkPart_workOrderId_fkey" TO "WorkPart_assignmentId_fkey";
ALTER TABLE "public"."WorkPart" RENAME CONSTRAINT "WorkPart_workActivityId_fkey" TO "WorkPart_activityId_fkey";
ALTER TABLE "public"."VehicleTrip" RENAME CONSTRAINT "VehicleTrip_workOrderId_fkey" TO "VehicleTrip_assignmentId_fkey";

-- ============================================================================
-- 5. UPDATE PERMISSION ROWS (preserve RolePermission junction rows)
-- ============================================================================
UPDATE "public"."Permission"
SET "name" = REPLACE("name", 'work-orders:', 'assignments:'),
    "resource" = 'assignments',
    "routePath" = REPLACE(COALESCE("routePath", ''), '/work-orders', '/assignments')
WHERE "resource" = 'work-orders';

UPDATE "public"."Permission"
SET "name" = REPLACE("name", 'work-activities:', 'assignment-activities:'),
    "resource" = 'assignment-activities'
WHERE "resource" = 'work-activities';

UPDATE "public"."Permission"
SET "name" = REPLACE("name", 'work-order-status:', 'assignment-status:'),
    "resource" = 'assignment-status',
    "routePath" = REPLACE(COALESCE("routePath", ''), '/work-order-status', '/assignment-status')
WHERE "resource" = 'work-order-status';

UPDATE "public"."Permission"
SET "name" = 'route:assignments',
    "routePath" = '/assignments'
WHERE "name" = 'route:work-orders';

-- Catch any other route permissions that referenced /work-orders or /work-order-status paths.
UPDATE "public"."Permission"
SET "routePath" = REPLACE("routePath", '/work-order-status', '/assignment-status')
WHERE "routePath" LIKE '%/work-order-status%';

UPDATE "public"."Permission"
SET "routePath" = REPLACE("routePath", '/work-orders', '/assignments')
WHERE "routePath" LIKE '%/work-orders%';

-- ============================================================================
-- 6. UPDATE Role.defaultPath where applicable
-- ============================================================================
UPDATE "public"."Role"
SET "defaultPath" = REPLACE("defaultPath", '/work-orders', '/assignments')
WHERE "defaultPath" LIKE '%/work-orders%';
