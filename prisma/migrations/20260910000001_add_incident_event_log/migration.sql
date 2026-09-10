-- Create the IncidentEvent append-only audit log (RF-219).
--
-- One row per status-affecting occurrence on an incident: creation, status
-- transitions, assignee changes, cancellations, reopens, bulk imports,
-- skipped recalculations, and (reserved) admin overrides. No backfill:
-- events begin at deploy, past history stays unrecoverable by design.
-- Additive table; rollback drops it (the silent-reopen guard in
-- syncIncidentState goes with it).

-- 1) Closed event vocabulary. Adding a type is a migration on purpose.
CREATE TYPE "IncidentEventType" AS ENUM (
  'CREATED',
  'STATUS_CHANGED',
  'ASSIGNEE_ADDED',
  'ASSIGNEE_REMOVED',
  'ASSIGNEE_AUTO_CREATED',
  'ASSIGN_DENIED',
  'CANCELLED',
  'REOPENED',
  'BULK_IMPORTED',
  'RECALC_SKIPPED',
  'ADMIN_OVERRIDE'
);

-- 2) Event rows. No `active` flag: append-only means no soft delete.
CREATE TABLE "IncidentEvent" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "incidentId" INTEGER NOT NULL,
  "eventType"  "IncidentEventType" NOT NULL,
  "actorId"    TEXT,
  "fromStatus" TEXT,
  "toStatus"   TEXT,
  "payload"    JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3) Timeline reads filter by incident and order by time.
CREATE INDEX "IncidentEvent_incidentId_createdAt_idx" ON "IncidentEvent"("incidentId", "createdAt");
