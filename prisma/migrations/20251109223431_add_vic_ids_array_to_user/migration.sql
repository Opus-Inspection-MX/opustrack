-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "vicIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
