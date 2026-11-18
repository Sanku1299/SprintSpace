import { describe, expect, it } from "vitest";

import { createPresignedUploadSchema, MAX_ATTACHMENT_SIZE } from "./attachment-upload";

const validUpload = {
  taskId: "507f1f77bcf86cd799439001",
  fileName: "notes.pdf",
  contentType: "application/pdf",
  size: 1200,
};

describe("createPresignedUploadSchema", () => {
  it("accepts an allowed file type and size", () => {
    expect(createPresignedUploadSchema.safeParse(validUpload).success).toBe(true);
  });

  it("rejects unsupported MIME types and files above the size limit", () => {
    expect(
      createPresignedUploadSchema.safeParse({
        ...validUpload,
        contentType: "application/x-msdownload",
      }).success,
    ).toBe(false);
    expect(
      createPresignedUploadSchema.safeParse({ ...validUpload, size: MAX_ATTACHMENT_SIZE + 1 })
        .success,
    ).toBe(false);
  });
});
