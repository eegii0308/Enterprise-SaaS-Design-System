export function normalizeKey(key: string): string {
  return key.replaceAll("\\", "/");
}

export function assertSafeKey(key: string): void {
  const normalized = normalizeKey(key);

  if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}
