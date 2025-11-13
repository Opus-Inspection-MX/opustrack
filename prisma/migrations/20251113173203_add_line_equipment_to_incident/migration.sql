-- AlterTable
ALTER TABLE "public"."Incident" ADD COLUMN     "equipmentId" INTEGER,
ADD COLUMN     "lineId" INTEGER;

-- CreateIndex
CREATE INDEX "Incident_lineId_idx" ON "public"."Incident"("lineId");

-- CreateIndex
CREATE INDEX "Incident_equipmentId_idx" ON "public"."Incident"("equipmentId");

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "public"."Line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "public"."Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
