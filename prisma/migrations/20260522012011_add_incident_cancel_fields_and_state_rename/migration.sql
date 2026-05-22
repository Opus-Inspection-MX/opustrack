-- DropForeignKey
ALTER TABLE "public"."Incident" DROP CONSTRAINT "Incident_typeId_fkey";

-- AlterTable
ALTER TABLE "public"."Incident" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."IncidentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
