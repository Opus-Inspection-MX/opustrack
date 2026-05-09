-- Replace Assignment.folio (String? "ODT folio") with an auto-generated Int sequence.

-- 1. Drop the old folio index (created with @@index([folio]) on the String column)
DROP INDEX IF EXISTS "Assignment_folio_idx";

-- 2. Drop the old String folio column
ALTER TABLE "Assignment" DROP COLUMN "folio";

-- 3. Create the sequence used to generate folios
CREATE SEQUENCE IF NOT EXISTS "assignment_folio_seq";

-- 4. Add the new Int folio column with the sequence as default; backfill with sequence values for existing rows
ALTER TABLE "Assignment"
  ADD COLUMN "folio" INTEGER NOT NULL DEFAULT nextval('assignment_folio_seq');

-- 5. Enforce uniqueness (also creates the index)
CREATE UNIQUE INDEX "Assignment_folio_key" ON "Assignment"("folio");

-- 6. Tie the sequence's ownership to the column so it's dropped if the column ever is
ALTER SEQUENCE "assignment_folio_seq" OWNED BY "Assignment"."folio";
