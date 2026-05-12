-- Replace Assignment.folio (String? "ODT folio") with an auto-incrementing Int.
-- Uses Postgres SERIAL so Prisma can manage it natively via @default(autoincrement()).

-- 1. Drop the old folio index (created with @@index([folio]) on the String column)
DROP INDEX IF EXISTS "Assignment_folio_idx";

-- 2. Drop the old String folio column
ALTER TABLE "Assignment" DROP COLUMN "folio";

-- 3. Add the new auto-incrementing Int folio column. SERIAL creates the
--    sequence "Assignment_folio_seq" and ties it to the column via OWNED BY.
ALTER TABLE "Assignment" ADD COLUMN "folio" SERIAL NOT NULL;

-- 4. Enforce uniqueness (also creates the index Prisma expects for @unique)
CREATE UNIQUE INDEX "Assignment_folio_key" ON "Assignment"("folio");
