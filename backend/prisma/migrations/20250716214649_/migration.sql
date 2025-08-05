/*
  Warnings:

  - The primary key for the `UserType` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `UserType` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `usertype_id` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_usertype_id_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "usertype_id",
ADD COLUMN     "usertype_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "UserType" DROP CONSTRAINT "UserType_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "UserType_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_usertype_id_fkey" FOREIGN KEY ("usertype_id") REFERENCES "UserType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
