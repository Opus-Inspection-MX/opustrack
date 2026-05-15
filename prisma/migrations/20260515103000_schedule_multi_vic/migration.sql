-- CreateTable
CREATE TABLE "ScheduleVic" (
    "scheduleId" TEXT NOT NULL,
    "vicId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleVic_pkey" PRIMARY KEY ("scheduleId","vicId")
);

-- CreateIndex
CREATE INDEX "ScheduleVic_vicId_idx" ON "ScheduleVic"("vicId");

-- CreateIndex
CREATE INDEX "ScheduleVic_scheduleId_idx" ON "ScheduleVic"("scheduleId");

-- AddForeignKey
ALTER TABLE "ScheduleVic" ADD CONSTRAINT "ScheduleVic_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVic" ADD CONSTRAINT "ScheduleVic_vicId_fkey" FOREIGN KEY ("vicId") REFERENCES "VehicleInspectionCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill from existing Schedule.vicId (one row per existing schedule)
INSERT INTO "ScheduleVic" ("scheduleId", "vicId", "active")
SELECT "id", "vicId", true FROM "Schedule" WHERE "vicId" IS NOT NULL;

-- Drop old FK + columns + enum + index
DROP INDEX IF EXISTS "Schedule_type_idx";
ALTER TABLE "Schedule" DROP CONSTRAINT IF EXISTS "Schedule_vicId_fkey";
ALTER TABLE "Schedule" DROP COLUMN "vicId";
ALTER TABLE "Schedule" DROP COLUMN "type";
DROP TYPE "ScheduleType";
