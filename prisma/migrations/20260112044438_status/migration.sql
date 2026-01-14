/*
  Warnings:

  - You are about to drop the column `status` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `VehicleTrip` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[serialNumber,lineId]` on the table `Equipment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,vicId]` on the table `Line` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `serialNumber` to the `Equipment` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Vehicle_status_idx";

-- DropIndex
DROP INDEX "public"."VehicleTrip_status_idx";

-- AlterTable
ALTER TABLE "public"."Equipment" ADD COLUMN     "model" TEXT,
ADD COLUMN     "serialNumber" TEXT NOT NULL,
ADD COLUMN     "statusId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."Line" ADD COLUMN     "statusId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."Vehicle" DROP COLUMN "status",
ADD COLUMN     "statusId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."VehicleTrip" DROP COLUMN "status",
ADD COLUMN     "statusId" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "public"."LineStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LineStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EquipmentStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EquipmentStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VehicleStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VehicleStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VehicleTripStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VehicleTripStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LineStatus_name_key" ON "public"."LineStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentStatus_name_key" ON "public"."EquipmentStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleStatus_name_key" ON "public"."VehicleStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTripStatus_name_key" ON "public"."VehicleTripStatus"("name");

-- CreateIndex
CREATE INDEX "Equipment_statusId_idx" ON "public"."Equipment"("statusId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_serialNumber_lineId_key" ON "public"."Equipment"("serialNumber", "lineId");

-- CreateIndex
CREATE INDEX "Line_statusId_idx" ON "public"."Line"("statusId");

-- CreateIndex
CREATE UNIQUE INDEX "Line_name_vicId_key" ON "public"."Line"("name", "vicId");

-- CreateIndex
CREATE INDEX "Vehicle_statusId_idx" ON "public"."Vehicle"("statusId");

-- CreateIndex
CREATE INDEX "VehicleTrip_statusId_idx" ON "public"."VehicleTrip"("statusId");

-- AddForeignKey
ALTER TABLE "public"."Line" ADD CONSTRAINT "Line_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."LineStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Equipment" ADD CONSTRAINT "Equipment_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."EquipmentStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."VehicleStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VehicleTrip" ADD CONSTRAINT "VehicleTrip_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."VehicleTripStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
