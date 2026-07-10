-- AlterEnum
ALTER TYPE "ImportStatus" ADD VALUE IF NOT EXISTS 'PENDING';

<<<<<<< HEAD
-- NOTE: Do NOT set the column default in the same migration that adds a new enum value.
-- New enum values must be committed before they can be used. Create a separate
-- migration that sets the default to 'PENDING' after this enum change has been
-- applied and committed.
=======
commit;

-- AlterTable
ALTER TABLE "import_batches" ALTER COLUMN "status" SET DEFAULT 'PENDING';
>>>>>>> e38af5d4f873be06e0bd232454df7269d9a3b301
