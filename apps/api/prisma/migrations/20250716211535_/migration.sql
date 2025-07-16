/*
  Warnings:

  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usertype_id` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "usertype_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "UserType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "UserType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserType_name_key" ON "UserType"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_usertype_id_fkey" FOREIGN KEY ("usertype_id") REFERENCES "UserType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
