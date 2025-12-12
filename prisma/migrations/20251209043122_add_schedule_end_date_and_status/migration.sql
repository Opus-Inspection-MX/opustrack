-- AlterTable
ALTER TABLE "public"."Schedule" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "statusId" INTEGER;

-- CreateIndex
CREATE INDEX "Schedule_statusId_idx" ON "public"."Schedule"("statusId");

-- CreateIndex
CREATE INDEX "Schedule_scheduledAt_idx" ON "public"."Schedule"("scheduledAt");

-- CreateIndex
CREATE INDEX "Schedule_endDate_idx" ON "public"."Schedule"("endDate");

-- AddForeignKey
ALTER TABLE "public"."Schedule" ADD CONSTRAINT "Schedule_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."IncidentStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
