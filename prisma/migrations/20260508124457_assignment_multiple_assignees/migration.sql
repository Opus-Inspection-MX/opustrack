-- Migrate Assignment.assignedToId (single FK) to AssignmentAssignee junction (M-N)

-- 1. Create junction table
CREATE TABLE "assignment_assignees" (
  "id"           TEXT PRIMARY KEY,
  "assignmentId" TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "assignedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "AssignmentAssignee_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AssignmentAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AssignmentAssignee_assignmentId_userId_key" ON "assignment_assignees"("assignmentId", "userId");
CREATE INDEX "AssignmentAssignee_userId_idx" ON "assignment_assignees"("userId");
CREATE INDEX "AssignmentAssignee_assignmentId_idx" ON "assignment_assignees"("assignmentId");
CREATE INDEX "AssignmentAssignee_active_userId_idx" ON "assignment_assignees"("active", "userId");

-- 2. Backfill from existing assignedToId
INSERT INTO "assignment_assignees" ("id", "assignmentId", "userId", "assignedAt", "active")
SELECT
  'aa_' || replace(gen_random_uuid()::text, '-', ''),
  a."id",
  a."assignedToId",
  COALESCE(a."assignedAt", a."createdAt"),
  a."active"
FROM "Assignment" a
WHERE a."assignedToId" IS NOT NULL;

-- 3. Drop old single-FK column and its indexes
ALTER TABLE "Assignment" DROP CONSTRAINT IF EXISTS "Assignment_assignedToId_fkey";
DROP INDEX IF EXISTS "Assignment_assignedToId_idx";
DROP INDEX IF EXISTS "Assignment_active_assignedToId_idx";
ALTER TABLE "Assignment" DROP COLUMN "assignedToId";
