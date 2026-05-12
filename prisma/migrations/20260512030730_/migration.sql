-- DropForeignKey
ALTER TABLE "public"."incident_assignees" DROP CONSTRAINT "IncidentAssignee_userId_fkey";

-- NOTE: The Prisma migration generator inserted a `DROP SEQUENCE
-- assignment_folio_seq` block here, but the schema still declares
-- `Assignment.folio` as `@default(dbgenerated("nextval('assignment_folio_seq')"))`
-- so the sequence must remain. The bogus block has been removed.

-- RenameForeignKey
ALTER TABLE "public"."assignment_assignees" RENAME CONSTRAINT "AssignmentAssignee_assignmentId_fkey" TO "assignment_assignees_assignmentId_fkey";

-- RenameForeignKey
ALTER TABLE "public"."assignment_assignees" RENAME CONSTRAINT "AssignmentAssignee_userId_fkey" TO "assignment_assignees_userId_fkey";

-- RenameForeignKey
ALTER TABLE "public"."incident_assignees" RENAME CONSTRAINT "IncidentAssignee_incidentId_fkey" TO "incident_assignees_incidentId_fkey";

-- AddForeignKey
ALTER TABLE "public"."incident_assignees" ADD CONSTRAINT "incident_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."AssignmentAssignee_active_userId_idx" RENAME TO "assignment_assignees_active_userId_idx";

-- RenameIndex
ALTER INDEX "public"."AssignmentAssignee_assignmentId_idx" RENAME TO "assignment_assignees_assignmentId_idx";

-- RenameIndex
ALTER INDEX "public"."AssignmentAssignee_assignmentId_userId_key" RENAME TO "assignment_assignees_assignmentId_userId_key";

-- RenameIndex
ALTER INDEX "public"."AssignmentAssignee_userId_idx" RENAME TO "assignment_assignees_userId_idx";

-- RenameIndex
ALTER INDEX "public"."IncidentAssignee_active_userId_idx" RENAME TO "incident_assignees_active_userId_idx";

-- RenameIndex
ALTER INDEX "public"."IncidentAssignee_incidentId_idx" RENAME TO "incident_assignees_incidentId_idx";

-- RenameIndex
ALTER INDEX "public"."IncidentAssignee_incidentId_userId_key" RENAME TO "incident_assignees_incidentId_userId_key";

-- RenameIndex
ALTER INDEX "public"."IncidentAssignee_userId_idx" RENAME TO "incident_assignees_userId_idx";
