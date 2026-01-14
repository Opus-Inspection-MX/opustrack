-- DropForeignKey
ALTER TABLE "public"."Schedule" DROP CONSTRAINT "Schedule_statusId_fkey";

-- DropIndex
DROP INDEX "public"."Equipment_serialNumber_lineId_key";

-- AlterTable
ALTER TABLE "public"."Equipment" ALTER COLUMN "serialNumber" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."ScheduleStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleStatus_name_key" ON "public"."ScheduleStatus"("name");

-- CreateIndex
CREATE INDEX "Equipment_serialNumber_idx" ON "public"."Equipment"("serialNumber");

-- AddForeignKey
ALTER TABLE "public"."Schedule" ADD CONSTRAINT "Schedule_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."ScheduleStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
