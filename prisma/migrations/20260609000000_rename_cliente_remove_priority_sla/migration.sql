-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_vicId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserVicAssignment" DROP CONSTRAINT "UserVicAssignment_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserVicAssignment" DROP CONSTRAINT "UserVicAssignment_vicId_fkey";

-- DropForeignKey
ALTER TABLE "public"."VehicleInspectionCenter" DROP CONSTRAINT "VehicleInspectionCenter_stateId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ScheduleVic" DROP CONSTRAINT "ScheduleVic_scheduleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ScheduleVic" DROP CONSTRAINT "ScheduleVic_vicId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Incident" DROP CONSTRAINT "Incident_vicId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Line" DROP CONSTRAINT "Line_vicId_fkey";

-- DropIndex
DROP INDEX "public"."Incident_vicId_idx";

-- DropIndex
DROP INDEX "public"."Line_vicId_idx";

-- DropIndex
DROP INDEX "public"."Line_name_vicId_key";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "vicId",
DROP COLUMN "vicIds",
ADD COLUMN     "clienteId" TEXT,
ADD COLUMN     "clienteIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "public"."IncidentType" DROP COLUMN "sla";

-- AlterTable
ALTER TABLE "public"."Incident" DROP COLUMN "priority",
DROP COLUMN "vicId",
ADD COLUMN     "clienteId" TEXT;

-- AlterTable
ALTER TABLE "public"."Line" DROP COLUMN "vicId",
ADD COLUMN     "clienteId" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."UserVicAssignment";

-- DropTable
DROP TABLE "public"."VehicleInspectionCenter";

-- DropTable
DROP TABLE "public"."ScheduleVic";

-- CreateTable
CREATE TABLE "public"."UserClienteAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserClienteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cliente" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "rfc" TEXT,
    "companyName" TEXT,
    "phone" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "stateId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScheduleCliente" (
    "scheduleId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleCliente_pkey" PRIMARY KEY ("scheduleId","clienteId")
);

-- CreateIndex
CREATE INDEX "UserClienteAssignment_userId_idx" ON "public"."UserClienteAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserClienteAssignment_clienteId_idx" ON "public"."UserClienteAssignment"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "UserClienteAssignment_userId_clienteId_key" ON "public"."UserClienteAssignment"("userId", "clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_code_key" ON "public"."Cliente"("code");

-- CreateIndex
CREATE INDEX "ScheduleCliente_clienteId_idx" ON "public"."ScheduleCliente"("clienteId");

-- CreateIndex
CREATE INDEX "ScheduleCliente_scheduleId_idx" ON "public"."ScheduleCliente"("scheduleId");

-- CreateIndex
CREATE INDEX "Incident_clienteId_idx" ON "public"."Incident"("clienteId");

-- CreateIndex
CREATE INDEX "Line_clienteId_idx" ON "public"."Line"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Line_name_clienteId_key" ON "public"."Line"("name", "clienteId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserClienteAssignment" ADD CONSTRAINT "UserClienteAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserClienteAssignment" ADD CONSTRAINT "UserClienteAssignment_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cliente" ADD CONSTRAINT "Cliente_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleCliente" ADD CONSTRAINT "ScheduleCliente_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "public"."Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleCliente" ADD CONSTRAINT "ScheduleCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Line" ADD CONSTRAINT "Line_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

