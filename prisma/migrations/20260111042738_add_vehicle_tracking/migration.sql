-- CreateTable
CREATE TABLE "public"."Vehicle" (
    "id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "vin" TEXT,
    "color" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VehicleTrip" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "fsrId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "startOdometer" INTEGER NOT NULL,
    "startPhotoUrl" TEXT NOT NULL,
    "startPhotoProvider" TEXT NOT NULL DEFAULT 'vercel-blob',
    "startLatitude" DOUBLE PRECISION,
    "startLongitude" DOUBLE PRECISION,
    "startAddress" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endOdometer" INTEGER,
    "endPhotoUrl" TEXT,
    "endPhotoProvider" TEXT,
    "endLatitude" DOUBLE PRECISION,
    "endLongitude" DOUBLE PRECISION,
    "endAddress" TEXT,
    "endedAt" TIMESTAMP(3),
    "kmDriven" INTEGER,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleTrip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_licensePlate_key" ON "public"."Vehicle"("licensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "public"."Vehicle"("vin");

-- CreateIndex
CREATE INDEX "Vehicle_licensePlate_idx" ON "public"."Vehicle"("licensePlate");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "public"."Vehicle"("status");

-- CreateIndex
CREATE INDEX "Vehicle_active_idx" ON "public"."Vehicle"("active");

-- CreateIndex
CREATE INDEX "VehicleTrip_vehicleId_idx" ON "public"."VehicleTrip"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleTrip_fsrId_idx" ON "public"."VehicleTrip"("fsrId");

-- CreateIndex
CREATE INDEX "VehicleTrip_workOrderId_idx" ON "public"."VehicleTrip"("workOrderId");

-- CreateIndex
CREATE INDEX "VehicleTrip_status_idx" ON "public"."VehicleTrip"("status");

-- CreateIndex
CREATE INDEX "VehicleTrip_startedAt_idx" ON "public"."VehicleTrip"("startedAt");

-- CreateIndex
CREATE INDEX "VehicleTrip_active_idx" ON "public"."VehicleTrip"("active");

-- AddForeignKey
ALTER TABLE "public"."VehicleTrip" ADD CONSTRAINT "VehicleTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VehicleTrip" ADD CONSTRAINT "VehicleTrip_fsrId_fkey" FOREIGN KEY ("fsrId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VehicleTrip" ADD CONSTRAINT "VehicleTrip_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
