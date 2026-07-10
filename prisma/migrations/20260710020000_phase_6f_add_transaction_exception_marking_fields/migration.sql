-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "exception_reason" TEXT,
ADD COLUMN     "exception_marked_by" TEXT,
ADD COLUMN     "exception_marked_at" TIMESTAMP(3),
ADD COLUMN     "exception_cleared_by" TEXT,
ADD COLUMN     "exception_cleared_at" TIMESTAMP(3);
