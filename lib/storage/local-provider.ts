import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./provider.ts";
import { assertSafeKey, normalizeKey } from "./key.ts";

export interface LocalStorageProviderConfig {
  root: string;
}

export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor(config: LocalStorageProviderConfig) {
    this.root = path.resolve(config.root);
  }

  private resolvePath(key: string): string {
    assertSafeKey(key);

    const storagePath = path.resolve(this.root, normalizeKey(key));

    if (storagePath !== this.root && !storagePath.startsWith(`${this.root}${path.sep}`)) {
      throw new Error(`Invalid storage key: ${key}`);
    }

    return storagePath;
  }

  async putFile(key: string, data: Buffer | string): Promise<void> {
    const storagePath = this.resolvePath(key);

    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, data);
  }

  async getFile(key: string): Promise<Buffer> {
    const storagePath = this.resolvePath(key);

    return readFile(storagePath);
  }
}
