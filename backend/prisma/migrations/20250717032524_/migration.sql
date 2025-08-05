-- AlterTable
ALTER TABLE "User" ADD COLUMN     "vic_id" TEXT;

-- AlterTable
ALTER TABLE "VehicleInspectionCenter" ADD COLUMN     "email" TEXT,
ADD COLUMN     "lines" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "address" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vic_id_fkey" FOREIGN KEY ("vic_id") REFERENCES "VehicleInspectionCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
