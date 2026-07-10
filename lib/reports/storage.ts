import path from "node:path";

const uploadRoot = process.env.REPORT_UPLOAD_ROOT ?? path.join(process.cwd(), ".uploads");

export function getReportStoragePath(fileStorageKey: string) {
  const normalizedKey = fileStorageKey.replaceAll("\\", "/");
  const storagePath = path.resolve(uploadRoot, normalizedKey);
  const storageRoot = path.resolve(uploadRoot);

  if (storagePath !== storageRoot && !storagePath.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("Invalid report storage key.");
  }

  return storagePath;
}
