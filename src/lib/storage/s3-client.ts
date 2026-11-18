import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import { getObjectStorageConfig } from "@/lib/storage/config";

let cachedClient: S3Client | null = null;

export function getObjectStorageClient() {
  const config = getObjectStorageConfig();
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: config.forcePathStyle,
      ...(config.accessKeyId && config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {}),
    });
  }

  return { client: cachedClient, config };
}
