import path from "node:path";

const uploadRoot = process.env.IMPORT_UPLOAD_ROOT ?? path.join(process.cwd(), ".uploads");

export function getImportStoragePath(fileStorageKey: string) {
  const normalizedKey = fileStorageKey.replaceAll("\\", "/");
  const storagePath = path.resolve(uploadRoot, normalizedKey);
  const storageRoot = path.resolve(uploadRoot);

  if (storagePath !== storageRoot && !storagePath.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("Invalid import storage key.");
  }

  return storagePath;
}
