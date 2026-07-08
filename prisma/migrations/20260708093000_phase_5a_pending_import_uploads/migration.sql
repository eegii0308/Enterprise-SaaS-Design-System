-- AlterEnum
ALTER TYPE "ImportStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- NOTE: Do NOT set the column default in the same migration that adds a new enum value.
-- New enum values must be committed before they can be used. Create a separate
-- migration that sets the default to 'PENDING' after this enum change has been
-- applied and committed.