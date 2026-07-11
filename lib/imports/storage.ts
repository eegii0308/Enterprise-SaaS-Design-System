import { getStorageProvider } from "@/lib/storage";

export async function putImportFile(fileStorageKey: string, data: Buffer): Promise<void> {
  await getStorageProvider().putFile(fileStorageKey, data, "text/csv");
}

export async function getImportFile(fileStorageKey: string): Promise<Buffer> {
  return getStorageProvider().getFile(fileStorageKey);
}
