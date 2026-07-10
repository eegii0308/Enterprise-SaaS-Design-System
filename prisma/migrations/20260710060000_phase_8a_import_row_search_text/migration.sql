-- AlterTable
ALTER TABLE "import_rows" ADD COLUMN "search_text" TEXT;

-- Backfill: flatten each existing row's raw_data values and error_messages
-- into a single searchable string, mirroring buildImportRowSearchText in
-- lib/imports/csv-core.ts. jsonb_typeof guards are needed because raw_data
-- is always an object but error_messages may be SQL NULL (Prisma.JsonNull)
-- for rows with no errors.
UPDATE "import_rows"
SET "search_text" = trim(
  COALESCE(
    (SELECT string_agg(value, ' ') FROM jsonb_each_text(CASE WHEN jsonb_typeof("raw_data") = 'object' THEN "raw_data" ELSE '{}'::jsonb END)),
    ''
  )
  || ' ' ||
  COALESCE(
    (SELECT string_agg(elem, ' ') FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof("error_messages") = 'array' THEN "error_messages" ELSE '[]'::jsonb END) AS elem),
    ''
  )
)
WHERE "search_text" IS NULL;

ALTER TABLE "import_rows" ALTER COLUMN "search_text" SET NOT NULL;
ALTER TABLE "import_rows" ALTER COLUMN "search_text" SET DEFAULT '';
