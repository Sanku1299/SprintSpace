import "server-only";

import { z } from "zod";

const storageEnvironmentSchema = z
  .object({
    OBJECT_STORAGE_BUCKET: z.string().trim().min(3).optional(),
    OBJECT_STORAGE_REGION: z.string().trim().min(1).default("us-east-1"),
    OBJECT_STORAGE_ENDPOINT: z.string().trim().url().optional(),
    OBJECT_STORAGE_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
    OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    OBJECT_STORAGE_FORCE_PATH_STYLE: z.enum(["true", "false"]).optional(),
  })
  .superRefine((config, context) => {
    const hasAccessKey = Boolean(config.OBJECT_STORAGE_ACCESS_KEY_ID);
    const hasSecretKey = Boolean(config.OBJECT_STORAGE_SECRET_ACCESS_KEY);

    if (hasAccessKey !== hasSecretKey) {
      context.addIssue({
        code: "custom",
        path: [hasAccessKey ? "OBJECT_STORAGE_SECRET_ACCESS_KEY" : "OBJECT_STORAGE_ACCESS_KEY_ID"],
        message: "Provide both object-storage credentials or leave both unset.",
      });
    }

    if (config.OBJECT_STORAGE_ENDPOINT) {
      const endpoint = new URL(config.OBJECT_STORAGE_ENDPOINT);
      const isLocalHttp =
        endpoint.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);

      if (endpoint.protocol !== "https:" && !isLocalHttp) {
        context.addIssue({
          code: "custom",
          path: ["OBJECT_STORAGE_ENDPOINT"],
          message: "Use HTTPS for object-storage endpoints except local development endpoints.",
        });
      }

      if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
        context.addIssue({
          code: "custom",
          path: ["OBJECT_STORAGE_ENDPOINT"],
          message: "The endpoint must not contain credentials, query parameters, or a fragment.",
        });
      }

      if (!hasAccessKey || !hasSecretKey) {
        context.addIssue({
          code: "custom",
          path: ["OBJECT_STORAGE_ACCESS_KEY_ID"],
          message: "Custom S3-compatible endpoints require explicit access credentials.",
        });
      }
    }
  });

export type ObjectStorageConfig = {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
};

/** Reads server-only S3-compatible settings without exposing credentials to the browser. */
export function getObjectStorageConfig(): ObjectStorageConfig {
  const parsed = storageEnvironmentSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      "Invalid object-storage configuration. Check the OBJECT_STORAGE_* environment variables.",
    );
  }

  const config = parsed.data;
  if (!config.OBJECT_STORAGE_BUCKET) {
    throw new Error("Missing OBJECT_STORAGE_BUCKET environment variable.");
  }

  const explicitPathStyle = config.OBJECT_STORAGE_FORCE_PATH_STYLE;
  return {
    bucket: config.OBJECT_STORAGE_BUCKET,
    region: config.OBJECT_STORAGE_REGION,
    ...(config.OBJECT_STORAGE_ENDPOINT
      ? { endpoint: new URL(config.OBJECT_STORAGE_ENDPOINT).toString().replace(/\/$/, "") }
      : {}),
    ...(config.OBJECT_STORAGE_ACCESS_KEY_ID && config.OBJECT_STORAGE_SECRET_ACCESS_KEY
      ? {
          accessKeyId: config.OBJECT_STORAGE_ACCESS_KEY_ID,
          secretAccessKey: config.OBJECT_STORAGE_SECRET_ACCESS_KEY,
        }
      : {}),
    forcePathStyle: explicitPathStyle
      ? explicitPathStyle === "true"
      : Boolean(config.OBJECT_STORAGE_ENDPOINT),
  };
}
