/*
  Warnings:

  - The primary key for the `Incident` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Incident` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `incidentId` on the `WorkOrder` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."Incident" DROP CONSTRAINT "Incident_reportedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Incident" DROP CONSTRAINT "Incident_statusId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Incident" DROP CONSTRAINT "Incident_typeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Incident" DROP CONSTRAINT "Incident_vicId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WorkOrder" DROP CONSTRAINT "WorkOrder_incidentId_fkey";

-- AlterTable
ALTER TABLE "public"."Incident" DROP CONSTRAINT "Incident_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ALTER COLUMN "typeId" DROP NOT NULL,
ALTER COLUMN "statusId" DROP NOT NULL,
ALTER COLUMN "vicId" DROP NOT NULL,
ALTER COLUMN "reportedById" DROP NOT NULL,
ADD CONSTRAINT "Incident_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."WorkOrder" DROP COLUMN "incidentId",
ADD COLUMN     "incidentId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."IncidentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."IncidentStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_vicId_fkey" FOREIGN KEY ("vicId") REFERENCES "public"."VehicleInspectionCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkOrder" ADD CONSTRAINT "WorkOrder_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "public"."Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
