-- AlterEnum
ALTER TYPE "ImportStatus" ADD VALUE IF NOT EXISTS 'PENDING';

commit;

-- AlterTable
ALTER TABLE "import_batches" ALTER COLUMN "status" SET DEFAULT 'PENDING';