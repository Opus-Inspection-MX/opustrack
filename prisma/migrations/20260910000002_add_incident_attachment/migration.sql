-- Create the IncidentAttachment evidence table (RF-217).
--
-- Field-for-field clone of AssignmentAttachment: evidence photos filed WITH
-- the incident report (the "before" state), uploaded from /client/new after
-- createIncidentAsClient resolves. No backfill: new table, empty on migrate.
-- Additive table; rollback drops it. Incident rows are untouched.

CREATE TABLE "IncidentAttachment" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "incidentId"  INTEGER NOT NULL,
  "filename"    TEXT NOT NULL,
  "filepath"    TEXT NOT NULL,
  "mimetype"    TEXT NOT NULL,
  "size"        INTEGER NOT NULL,
  "description" TEXT,
  "provider"    TEXT NOT NULL DEFAULT 'vercel-blob',
  "uploadedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "IncidentAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "IncidentAttachment_incidentId_idx" ON "IncidentAttachment"("incidentId");
