import { GetObjectCommand, PutObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import type { StorageProvider } from "./provider.ts";
import { assertSafeKey, normalizeKey } from "./key.ts";

export interface S3StorageProviderConfig {
  bucket: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3StorageProviderConfig) {
    this.bucket = config.bucket;

    const clientConfig: S3ClientConfig = {
      region: config.region ?? "auto",
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
    };

    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    this.client = new S3Client(clientConfig);
  }

  async putFile(key: string, data: Buffer | string, contentType?: string): Promise<void> {
    assertSafeKey(key);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: normalizeKey(key),
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  async getFile(key: string): Promise<Buffer> {
    assertSafeKey(key);

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: normalizeKey(key),
      }),
    );

    if (!response.Body) {
      throw new Error(`Object not found for key: ${key}`);
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }
}
