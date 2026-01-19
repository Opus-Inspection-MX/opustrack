-- AlterTable
ALTER TABLE "public"."WorkOrder" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "unlockedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WorkOrder_unlockedAt_idx" ON "public"."WorkOrder"("unlockedAt");
