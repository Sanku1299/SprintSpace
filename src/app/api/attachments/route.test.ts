import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    task: Record<string, unknown> | null;
    access: Record<string, unknown> | null;
    existing: Record<string, unknown> | null;
    object: { ContentLength?: number; ContentType?: string };
  } = { context: null, task: null, access: null, existing: null, object: {} };
  const attachmentQuery = {
    select: vi.fn(() => attachmentQuery),
    lean: vi.fn(async () => values.existing),
  };

  return {
    values,
    attachmentQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    findTask: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return {
        select: vi.fn(() => ({ lean: vi.fn(async () => values.task) })),
      };
    }),
    findAttachment: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return attachmentQuery;
    }),
    createAttachment: vi.fn(async (document: Record<string, unknown>) => ({
      ...document,
      _id: { toString: () => "507f1f77bcf86cd799439099" },
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    })),
    getAccess: vi.fn(async () => values.access),
    getStorageClient: vi.fn(() => ({
      client: { send: mocks.sendObject },
      config: { bucket: "private-bucket" },
    })),
    sendObject: vi.fn(async (command: { input?: unknown }) => {
      void command;
      return values.object;
    }),
  };
});

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
  Attachment: { findOne: mocks.findAttachment, create: mocks.createAttachment },
}));
vi.mock("@/models/Task", () => ({ Task: { findOne: mocks.findTask } }));

import { POST } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const projectId = "507f1f77bcf86cd799439002";
const taskId = "507f1f77bcf86cd799439003";
const managerId = "507f1f77bcf86cd799439004";
const storageKey = `${workspaceId}/${projectId}/tasks/${taskId}/550e8400-e29b-41d4-a716-446655440000`;

function id(value: string) {
  return { toString: () => value };
}

function registrationRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/attachments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      taskId,
      storageKey,
      originalName: "planning.png",
      contentType: "image/png",
      size: 1024,
      ...overrides,
    }),
  });
}

describe("POST /api/attachments", () => {
  beforeEach(() => {
    mocks.values.context = { userId: managerId, workspaceId, role: "project_manager" };
    mocks.values.task = {
      _id: id(taskId),
      workspaceId: id(workspaceId),
      projectId: id(projectId),
      assigneeId: null,
      allowedEditorIds: [],
    };
    mocks.values.access = {
      project: {
        _id: id(projectId),
        workspaceId: id(workspaceId),
        projectManagerId: id(managerId),
      },
      isProjectMember: false,
    };
    mocks.values.existing = null;
    mocks.values.object = { ContentLength: 1024, ContentType: "image/png" };
    vi.clearAllMocks();
  });

  it("registers metadata only after S3 confirms matching size and MIME type", async () => {
    const response = await POST(registrationRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.sendObject.mock.calls[0]?.[0].input).toEqual({
      Bucket: "private-bucket",
      Key: storageKey,
    });
    expect(mocks.createAttachment).toHaveBeenCalledOnce();
    const [created] = mocks.createAttachment.mock.calls[0] ?? [];
    expect(created).toMatchObject({
      workspaceId,
      uploadedBy: managerId,
      storageKey,
      originalName: "planning.png",
      mimeType: "image/png",
      size: 1024,
    });
    expect((created?.projectId as { toString(): string }).toString()).toBe(projectId);
    expect((created?.taskId as { toString(): string }).toString()).toBe(taskId);
    expect(body.data.attachment).toMatchObject({
      taskId,
      projectId,
      originalName: "planning.png",
      mimeType: "image/png",
      size: 1024,
    });
  });

  it("rejects a storage key outside the current workspace, project, and task", async () => {
    const response = await POST(
      registrationRequest({ storageKey: `other/${projectId}/tasks/${taskId}/file-id` }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_STORAGE_KEY");
    expect(mocks.sendObject).not.toHaveBeenCalled();
    expect(mocks.createAttachment).not.toHaveBeenCalled();
  });

  it.each([
    ["size", { ContentLength: 2048, ContentType: "image/png" }],
    ["MIME type", { ContentLength: 1024, ContentType: "application/pdf" }],
  ])("rejects an S3 object with a mismatched %s", async (_label, object) => {
    mocks.values.object = object;

    const response = await POST(registrationRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("UPLOAD_MISMATCH");
    expect(mocks.createAttachment).not.toHaveBeenCalled();
  });

  it("does not register a task ID from another workspace", async () => {
    mocks.values.task = null;

    const response = await POST(registrationRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(mocks.findTask).toHaveBeenCalledWith({ _id: taskId, workspaceId });
    expect(mocks.getAccess).not.toHaveBeenCalled();
    expect(mocks.createAttachment).not.toHaveBeenCalled();
  });
});
