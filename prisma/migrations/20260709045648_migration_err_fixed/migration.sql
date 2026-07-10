-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_organization_id_import_batch_id_fkey";

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_import_batch_id_fkey" FOREIGN KEY ("organization_id", "import_batch_id") REFERENCES "import_batches"("organization_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
