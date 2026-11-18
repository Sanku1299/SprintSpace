import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    attachment: Record<string, unknown> | null;
    task: Record<string, unknown> | null;
    access: Record<string, unknown> | null;
    objectDeleteFailures: number;
    metadataDeleteFailures: number;
    deletionEvents: string[];
  } = {
    context: null,
    attachment: null,
    task: null,
    access: null,
    objectDeleteFailures: 0,
    metadataDeleteFailures: 0,
    deletionEvents: [],
  };
  const attachmentQuery = {
    select: vi.fn(() => attachmentQuery),
    lean: vi.fn(async () => values.attachment),
  };

  return {
    values,
    attachmentQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    findAttachment: vi.fn((filter: Record<string, unknown>) => {
      const deletingFilter = filter.deletionStatus as { $ne?: string } | undefined;
      if (deletingFilter?.$ne === "deleting" && values.attachment?.deletionStatus === "deleting") {
        return {
          select: vi.fn(() => ({ lean: vi.fn(async () => null) })),
        };
      }
      return attachmentQuery;
    }),
    updateAttachment: vi.fn(async (_filter: unknown, update: Record<string, unknown>) => {
      values.deletionEvents.push("marker");
      const set = update.$set as Record<string, unknown> | undefined;
      if (set?.deletionStatus && values.attachment) {
        values.attachment.deletionStatus = set.deletionStatus;
      }
      return { matchedCount: values.attachment ? 1 : 0 };
    }),
    deleteAttachment: vi.fn(async () => {
      values.deletionEvents.push("metadata");
      if (values.metadataDeleteFailures > 0) {
        values.metadataDeleteFailures -= 1;
        throw new Error("Mongo delete failed");
      }
      values.attachment = null;
      return { deletedCount: 1 };
    }),
    findTask: vi.fn((filter: Record<string, unknown>) => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => {
          void filter;
          return values.task;
        }),
      })),
    })),
    getAccess: vi.fn(async () => values.access),
    getStorageClient: vi.fn(() => ({
      client: {
        send: vi.fn(async () => {
          values.deletionEvents.push("s3");
          if (values.objectDeleteFailures > 0) {
            values.objectDeleteFailures -= 1;
            throw new Error("S3 delete failed");
          }
        }),
      },
      config: { bucket: "private-bucket" },
    })),
    getSignedUrl: vi.fn(async () => "https://storage.example.test/signed-download"),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mocks.getSignedUrl }));
vi.mock("@/lib/auth/company-role", () => ({
  hasCompanyRole: (context: { role: string }, ...roles: string[]) => roles.includes(context.role),
}));
vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: mocks.getContext }));
vi.mock("@/lib/auth/workspace-scope", () => ({
  workspaceScopedFilter: (context: { workspaceId: string }, filter: Record<string, unknown>) => ({
    ...filter,
    workspaceId: context.workspaceId,
  }),
}));
vi.mock("@/lib/db/mongoose", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/lib/storage/s3-client", () => ({ getObjectStorageClient: mocks.getStorageClient }));
vi.mock("@/lib/tasks/task-project-access", () => ({
  getAccessibleTaskProject: mocks.getAccess,
}));
vi.mock("@/models/Attachment", () => ({
  Attachment: {
    findOne: mocks.findAttachment,
    updateOne: mocks.updateAttachment,
    deleteOne: mocks.deleteAttachment,
  },
}));
vi.mock("@/models/Task", () => ({ Task: { findOne: mocks.findTask } }));

import { DELETE, GET } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const projectId = "507f1f77bcf86cd799439002";
const taskId = "507f1f77bcf86cd799439003";
const attachmentId = "507f1f77bcf86cd799439004";
const uploaderId = "507f1f77bcf86cd799439005";
const managerId = "507f1f77bcf86cd799439006";
const otherUserId = "507f1f77bcf86cd799439007";
const storageKey = `${workspaceId}/${projectId}/tasks/${taskId}/550e8400-e29b-41d4-a716-446655440000`;

function id(value: string) {
  return { toString: () => value };
}

function attachment(overrides: Record<string, unknown> = {}) {
  return {
    _id: id(attachmentId),
    workspaceId: id(workspaceId),
    projectId: id(projectId),
    taskId: id(taskId),
    uploadedBy: id(uploaderId),
    storageKey,
    originalName: "planning image.png",
    mimeType: "image/png",
    size: 1024,
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    deletionStatus: "active",
    ...overrides,
  };
}

function routeContext(id = attachmentId) {
  return { params: Promise.resolve({ attachmentId: id }) };
}

describe("/api/attachments/[attachmentId]", () => {
  beforeEach(() => {
    mocks.values.context = { userId: uploaderId, workspaceId, role: "developer" };
    mocks.values.attachment = attachment();
    mocks.values.task = { _id: id(taskId) };
    mocks.values.access = {
      project: { _id: id(projectId), projectManagerId: id(managerId) },
    };
    mocks.values.objectDeleteFailures = 0;
    mocks.values.metadataDeleteFailures = 0;
    mocks.values.deletionEvents = [];
    vi.clearAllMocks();
  });

  it("issues a short-lived signed URL for an active workspace attachment", async () => {
    const response = await GET(new Request("http://localhost"), routeContext());
    const body = await response.json();
    const [filter] = mocks.findAttachment.mock.calls[0] ?? [];

    expect(response.status).toBe(200);
    expect(filter).toEqual({ _id: attachmentId, deletionStatus: { $ne: "deleting" }, workspaceId });
    expect(mocks.getSignedUrl).toHaveBeenCalledOnce();
    expect(body.data).toMatchObject({
      attachmentId,
      downloadUrl: "https://storage.example.test/signed-download",
      originalName: "planning image.png",
      mimeType: "image/png",
      size: 1024,
    });
  });

  it("hides attachments already marked for deletion from downloads", async () => {
    mocks.values.attachment = attachment({ deletionStatus: "deleting" });

    const response = await GET(new Request("http://localhost"), routeContext());
    const body = await response.json();
    const [filter] = mocks.findAttachment.mock.calls[0] ?? [];

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(filter).toEqual({ _id: attachmentId, deletionStatus: { $ne: "deleting" }, workspaceId });
    expect(mocks.getSignedUrl).not.toHaveBeenCalled();
  });

  it("does not expose attachments outside the current workspace", async () => {
    mocks.values.context = { userId: otherUserId, workspaceId, role: "admin" };
    mocks.values.attachment = null;

    const response = await GET(new Request("http://localhost"), routeContext());
    const body = await response.json();
    const [filter] = mocks.findAttachment.mock.calls[0] ?? [];

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(filter).toEqual({ _id: attachmentId, deletionStatus: { $ne: "deleting" }, workspaceId });
    expect(mocks.getSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["uploader", uploaderId, "developer"],
    ["workspace Admin", otherUserId, "admin"],
    ["responsible PM", managerId, "project_manager"],
  ])("allows the %s to delete the attachment", async (_label, userId, role) => {
    mocks.values.context = { userId, workspaceId, role };

    const response = await DELETE(new Request("http://localhost"), routeContext());

    expect(response.status).toBe(200);
    const [filter, update] = mocks.updateAttachment.mock.calls[0] ?? [];
    const updateFilter = filter as Record<string, unknown> | undefined;
    expect(updateFilter).toMatchObject({ workspaceId });
    expect((updateFilter?._id as { toString(): string }).toString()).toBe(attachmentId);
    expect(update).toEqual({ $set: { deletionStatus: "deleting" } });
    expect(mocks.deleteAttachment).toHaveBeenCalledOnce();
  });

  it("denies deletion by a non-uploader who is neither Admin nor responsible PM", async () => {
    mocks.values.context = { userId: otherUserId, workspaceId, role: "developer" };

    const response = await DELETE(new Request("http://localhost"), routeContext());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mocks.updateAttachment).not.toHaveBeenCalled();
    expect(mocks.deleteAttachment).not.toHaveBeenCalled();
    expect(mocks.values.deletionEvents).toEqual(["marker", "s3"]);
  });

  it("keeps the deletion marker after S3 failure and resumes on retry", async () => {
    mocks.values.objectDeleteFailures = 1;

    const firstResponse = await DELETE(new Request("http://localhost"), routeContext());
    expect(firstResponse.status).toBe(503);
    expect(mocks.values.attachment?.deletionStatus).toBe("deleting");
    expect(mocks.deleteAttachment).not.toHaveBeenCalled();

    const retryResponse = await DELETE(new Request("http://localhost"), routeContext());

    expect(retryResponse.status).toBe(200);
    expect(mocks.deleteAttachment).toHaveBeenCalledOnce();
    expect(mocks.values.attachment).toBeNull();
    expect(mocks.values.deletionEvents).toEqual(["marker", "s3", "marker", "s3", "metadata"]);
  });

  it("retries S3 and metadata cleanup when Mongo deletion fails", async () => {
    mocks.values.metadataDeleteFailures = 1;

    const firstResponse = await DELETE(new Request("http://localhost"), routeContext());
    expect(firstResponse.status).toBe(503);
    expect(mocks.values.attachment?.deletionStatus).toBe("deleting");
    expect(mocks.values.deletionEvents).toEqual(["marker", "s3", "metadata"]);

    const retryResponse = await DELETE(new Request("http://localhost"), routeContext());

    expect(retryResponse.status).toBe(200);
    expect(mocks.deleteAttachment).toHaveBeenCalledTimes(2);
    expect(mocks.values.attachment).toBeNull();
    expect(mocks.values.deletionEvents).toEqual([
      "marker",
      "s3",
      "metadata",
      "marker",
      "s3",
      "metadata",
    ]);
  });
});
