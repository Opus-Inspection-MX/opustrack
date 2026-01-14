-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "public"."UserVicAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vicId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVicAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserVicAssignment_userId_idx" ON "public"."UserVicAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserVicAssignment_vicId_idx" ON "public"."UserVicAssignment"("vicId");

-- CreateIndex
CREATE UNIQUE INDEX "UserVicAssignment_userId_vicId_key" ON "public"."UserVicAssignment"("userId", "vicId");

-- AddForeignKey
ALTER TABLE "public"."UserVicAssignment" ADD CONSTRAINT "UserVicAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserVicAssignment" ADD CONSTRAINT "UserVicAssignment_vicId_fkey" FOREIGN KEY ("vicId") REFERENCES "public"."VehicleInspectionCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
