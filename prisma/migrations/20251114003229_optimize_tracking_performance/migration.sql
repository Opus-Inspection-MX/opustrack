-- CreateIndex
CREATE INDEX "Incident_reportedAt_idx" ON "public"."Incident"("reportedAt");

-- CreateIndex
CREATE INDEX "Incident_active_reportedAt_idx" ON "public"."Incident"("active", "reportedAt");

-- CreateIndex
CREATE INDEX "WorkOrder_folio_idx" ON "public"."WorkOrder"("folio");

-- CreateIndex
CREATE INDEX "WorkOrder_active_assignedToId_idx" ON "public"."WorkOrder"("active", "assignedToId");

-- CreateIndex
CREATE INDEX "WorkOrder_active_createdAt_idx" ON "public"."WorkOrder"("active", "createdAt");
