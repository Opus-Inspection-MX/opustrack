/*
  Warnings:

  - You are about to drop the column `vicId` on the `Part` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Part` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Part" DROP CONSTRAINT "Part_vicId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WorkOrder" DROP CONSTRAINT "WorkOrder_statusId_fkey";

-- DropIndex
DROP INDEX "public"."Part_name_vicId_key";

-- DropIndex
DROP INDEX "public"."Part_vicId_idx";

-- AlterTable
ALTER TABLE "public"."Part" DROP COLUMN "vicId";

-- CreateTable
CREATE TABLE "public"."WorkOrderStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WorkOrderStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderStatus_name_key" ON "public"."WorkOrderStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Part_name_key" ON "public"."Part"("name");

-- AddForeignKey
ALTER TABLE "public"."WorkOrder" ADD CONSTRAINT "WorkOrder_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."WorkOrderStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
