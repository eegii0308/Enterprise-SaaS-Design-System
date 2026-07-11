export interface StorageProvider {
  putFile(key: string, data: Buffer | string, contentType?: string): Promise<void>;
  getFile(key: string): Promise<Buffer>;
}
