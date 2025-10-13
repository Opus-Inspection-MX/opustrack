/*
  Warnings:

  - A unique constraint covering the columns `[name,vicId]` on the table `Part` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."WorkActivity" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."WorkPart" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Incident_vicId_idx" ON "public"."Incident"("vicId");

-- CreateIndex
CREATE INDEX "Incident_statusId_idx" ON "public"."Incident"("statusId");

-- CreateIndex
CREATE INDEX "Incident_typeId_idx" ON "public"."Incident"("typeId");

-- CreateIndex
CREATE INDEX "Incident_reportedById_idx" ON "public"."Incident"("reportedById");

-- CreateIndex
CREATE INDEX "Part_vicId_idx" ON "public"."Part"("vicId");

-- CreateIndex
CREATE UNIQUE INDEX "Part_name_vicId_key" ON "public"."Part"("name", "vicId");

-- CreateIndex
CREATE INDEX "WorkActivity_workOrderId_idx" ON "public"."WorkActivity"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrder_incidentId_idx" ON "public"."WorkOrder"("incidentId");

-- CreateIndex
CREATE INDEX "WorkOrder_assignedToId_idx" ON "public"."WorkOrder"("assignedToId");

-- CreateIndex
CREATE INDEX "WorkOrderAttachment_workOrderId_idx" ON "public"."WorkOrderAttachment"("workOrderId");

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
