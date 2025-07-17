/*
  Warnings:

  - Added the required column `userstatus_id` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "userStatusId" INTEGER,
ADD COLUMN     "userstatus_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "UserStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "UserStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserStatus_name_key" ON "UserStatus"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_userStatusId_fkey" FOREIGN KEY ("userStatusId") REFERENCES "UserStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
