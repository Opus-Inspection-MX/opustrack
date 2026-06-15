-- AlterTable
ALTER TABLE "public"."Assignment" ADD COLUMN     "scheduledDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."holidays" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER,
    "nthMonday" INTEGER,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "year" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vacation_statuses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vacations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "statusId" INTEGER NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holidays_active_idx" ON "public"."holidays"("active");

-- CreateIndex
CREATE INDEX "holidays_month_idx" ON "public"."holidays"("month");

-- CreateIndex
CREATE UNIQUE INDEX "vacation_statuses_name_key" ON "public"."vacation_statuses"("name");

-- CreateIndex
CREATE INDEX "vacations_userId_idx" ON "public"."vacations"("userId");

-- CreateIndex
CREATE INDEX "vacations_statusId_idx" ON "public"."vacations"("statusId");

-- CreateIndex
CREATE INDEX "vacations_userId_startDate_endDate_idx" ON "public"."vacations"("userId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "vacations_active_userId_idx" ON "public"."vacations"("active", "userId");

-- CreateIndex
CREATE INDEX "Assignment_scheduledDate_idx" ON "public"."Assignment"("scheduledDate");

-- AddForeignKey
ALTER TABLE "public"."vacations" ADD CONSTRAINT "vacations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vacations" ADD CONSTRAINT "vacations_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."vacation_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vacations" ADD CONSTRAINT "vacations_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
