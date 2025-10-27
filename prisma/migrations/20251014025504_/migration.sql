/*
  Warnings:

  - You are about to drop the column `status` on the `WorkOrder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."WorkOrder" DROP COLUMN "status",
ADD COLUMN     "statusId" INTEGER;

-- CreateIndex
CREATE INDEX "WorkOrder_statusId_idx" ON "public"."WorkOrder"("statusId");

-- AddForeignKey
ALTER TABLE "public"."WorkOrder" ADD CONSTRAINT "WorkOrder_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."IncidentStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
