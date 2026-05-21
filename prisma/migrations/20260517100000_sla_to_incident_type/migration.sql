-- AlterTable: Add nullable sla to IncidentType
ALTER TABLE "IncidentType" ADD COLUMN "sla" INTEGER;

-- AlterTable: Drop sla from Incident
ALTER TABLE "Incident" DROP COLUMN "sla";

-- AlterTable: Make typeId NOT NULL on Incident.
-- Requires that every existing Incident row has typeId set; if not, the
-- migration fails. The intended workflow is a db:reset, so this is safe.
ALTER TABLE "Incident" ALTER COLUMN "typeId" SET NOT NULL;
