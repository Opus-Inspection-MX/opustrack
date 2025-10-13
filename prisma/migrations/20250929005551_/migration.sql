/*
  Warnings:

  - Added the required column `defaultPath` to the `Role` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Role" ADD COLUMN     "defaultPath" TEXT NOT NULL;
