-- RF-024: Add type column to Schedule (Diaria | Mensual)

CREATE TYPE "ScheduleType" AS ENUM ('DIARIA', 'MENSUAL');

ALTER TABLE "Schedule" ADD COLUMN "type" "ScheduleType" NOT NULL DEFAULT 'DIARIA';

CREATE INDEX "Schedule_type_idx" ON "Schedule"("type");
