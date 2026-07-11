import path from "node:path";
import type { StorageProvider } from "./provider.ts";
import { LocalStorageProvider } from "./local-provider.ts";
import { S3StorageProvider } from "./s3-provider.ts";

export type { StorageProvider } from "./provider.ts";

function createStorageProvider(): StorageProvider {
  const driver = process.env.STORAGE_DRIVER ?? "local";

  if (driver === "s3") {
    const bucket = process.env.STORAGE_BUCKET;

    if (!bucket) {
      throw new Error("STORAGE_BUCKET is required when STORAGE_DRIVER=s3.");
    }

    return new S3StorageProvider({
      bucket,
      region: process.env.STORAGE_REGION,
      endpoint: process.env.STORAGE_ENDPOINT,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
    });
  }

  if (driver !== "local") {
    throw new Error(`Unknown STORAGE_DRIVER "${driver}". Expected "local" or "s3".`);
  }

  return new LocalStorageProvider({
    root: process.env.STORAGE_LOCAL_ROOT ?? path.join(process.cwd(), ".uploads"),
  });
}

const globalForStorage = globalThis as unknown as { storageProvider?: StorageProvider };

export function getStorageProvider(): StorageProvider {
  if (globalForStorage.storageProvider) {
    return globalForStorage.storageProvider;
  }

  const provider = createStorageProvider();

  if (process.env.NODE_ENV !== "production") {
    globalForStorage.storageProvider = provider;
  }

  return provider;
}
