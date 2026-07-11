import { getStorageProvider } from "@/lib/storage";

export async function putReportFile(fileStorageKey: string, data: Buffer | string): Promise<void> {
  await getStorageProvider().putFile(fileStorageKey, data, "text/csv");
}

export async function getReportFile(fileStorageKey: string): Promise<Buffer> {
  return getStorageProvider().getFile(fileStorageKey);
}
