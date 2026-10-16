-- CreateEnum
CREATE TYPE "VacationCycleBasis" AS ENUM ('CALENDAR', 'ANNIVERSARY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "vacationCycleBasis" "VacationCycleBasis" NOT NULL DEFAULT 'CALENDAR';

-- AlterTable
ALTER TABLE "vacation_periods" ADD COLUMN     "cycleBasis" "VacationCycleBasis" NOT NULL DEFAULT 'CALENDAR',
ADD COLUMN     "importBlocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "vacation_workbooks" (
    "digest" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "source" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vacation_workbooks_pkey" PRIMARY KEY ("digest")
);

-- CreateTable
CREATE TABLE "vacation_workbook_rows" (
    "id" TEXT NOT NULL,
    "workbookDigest" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "cycleYear" INTEGER NOT NULL,
    "sourceName" TEXT NOT NULL,
    "hireDate" TIMESTAMP(3),
    "yearsOfService" INTEGER NOT NULL,
    "entitledDays" INTEGER,
    "takenDays" INTEGER,
    "remainingDays" INTEGER,
    "userId" TEXT,
    "issues" TEXT[],
    "reviewStatus" "HistoricalVacationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "sourceValues" JSONB NOT NULL,

    CONSTRAINT "vacation_workbook_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vacation_workbook_rows_userId_cycleYear_idx" ON "vacation_workbook_rows"("userId", "cycleYear");

-- CreateIndex
CREATE UNIQUE INDEX "vacation_workbook_rows_workbookDigest_sourceSheet_sourceRow_key" ON "vacation_workbook_rows"("workbookDigest", "sourceSheet", "sourceRow");

-- AddForeignKey
ALTER TABLE "vacation_workbook_rows" ADD CONSTRAINT "vacation_workbook_rows_workbookDigest_fkey" FOREIGN KEY ("workbookDigest") REFERENCES "vacation_workbooks"("digest") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_workbook_rows" ADD CONSTRAINT "vacation_workbook_rows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

