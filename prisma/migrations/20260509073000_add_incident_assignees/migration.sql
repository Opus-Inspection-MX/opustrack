-- RF-025: Tabla pivote Incident <-> User (FSRs habilitados por incidencia)
CREATE TABLE "incident_assignees" (
  "id"         TEXT PRIMARY KEY,
  "incidentId" INTEGER NOT NULL,
  "userId"     TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "active"     BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "IncidentAssignee_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "IncidentAssignee_userId_fkey"     FOREIGN KEY ("userId")     REFERENCES "User"("id")     ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "IncidentAssignee_incidentId_userId_key" ON "incident_assignees"("incidentId", "userId");
CREATE INDEX "IncidentAssignee_userId_idx"        ON "incident_assignees"("userId");
CREATE INDEX "IncidentAssignee_incidentId_idx"    ON "incident_assignees"("incidentId");
CREATE INDEX "IncidentAssignee_active_userId_idx" ON "incident_assignees"("active", "userId");
