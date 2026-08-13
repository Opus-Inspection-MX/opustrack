-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "hireDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."vacations" ADD COLUMN     "businessDaysUsed" INTEGER,
ADD COLUMN     "periodId" TEXT;

-- CreateTable
CREATE TABLE "public"."vacation_accrual_rules" (
    "id" SERIAL NOT NULL,
    "minYears" INTEGER NOT NULL,
    "maxYears" INTEGER,
    "days" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_accrual_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vacation_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "graceWindowMonths" INTEGER NOT NULL DEFAULT 12,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vacation_periods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "accrualStart" TIMESTAMP(3) NOT NULL,
    "accrualEnd" TIMESTAMP(3) NOT NULL,
    "graceEnd" TIMESTAMP(3) NOT NULL,
    "ruleDays" INTEGER NOT NULL,
    "overrideDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vacation_accrual_rules_minYears_key" ON "public"."vacation_accrual_rules"("minYears");

-- CreateIndex
CREATE INDEX "vacation_accrual_rules_active_idx" ON "public"."vacation_accrual_rules"("active");

-- CreateIndex
CREATE INDEX "vacation_periods_userId_idx" ON "public"."vacation_periods"("userId");

-- CreateIndex
CREATE INDEX "vacation_periods_accrualStart_graceEnd_idx" ON "public"."vacation_periods"("accrualStart", "graceEnd");

-- CreateIndex
CREATE UNIQUE INDEX "vacation_periods_userId_periodNumber_key" ON "public"."vacation_periods"("userId", "periodNumber");

-- CreateIndex
CREATE INDEX "vacations_periodId_idx" ON "public"."vacations"("periodId");

-- AddForeignKey
ALTER TABLE "public"."vacations" ADD CONSTRAINT "vacations_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."vacation_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vacation_periods" ADD CONSTRAINT "vacation_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
