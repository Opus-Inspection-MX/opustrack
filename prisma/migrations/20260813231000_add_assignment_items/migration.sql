-- Free-text list of parts or equipment used on an assignment.
--
-- Replaces the `WorkPart`/`Part` pair dropped in the previous migration. No
-- foreign key into a catalogue on purpose: a catalogue with stock is a
-- warehouse, and the technician only needs to record what was used, how many,
-- and what each one cost.
CREATE TABLE "AssignmentItem" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AssignmentItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssignmentItem_assignmentId_idx" ON "AssignmentItem"("assignmentId");

ALTER TABLE "AssignmentItem" ADD CONSTRAINT "AssignmentItem_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
