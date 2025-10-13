-- AlterTable
ALTER TABLE "public"."Permission" ADD COLUMN     "action" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "resource" TEXT,
ADD COLUMN     "routePath" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."Role" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Permission_resource_action_idx" ON "public"."Permission"("resource", "action");

-- CreateIndex
CREATE INDEX "Permission_routePath_idx" ON "public"."Permission"("routePath");
