import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    task: Record<string, unknown> | null;
    access: Record<string, unknown> | null;
  } = { context: null, task: null, access: null };
  const taskQuery = {
    select: vi.fn(() => taskQuery),
    lean: vi.fn(async () => values.task),
  };

  return {
    values,
    taskQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    findTask: vi.fn(() => taskQuery),
    getAccess: vi.fn(async () => values.access),
    getStorageClient: vi.fn(() => ({ client: {}, config: { bucket: "private-bucket" } })),
    createPresignedPost: vi.fn(async (_client: unknown, _options: Record<string, unknown>) => {
      void _client;
      void _options;
      return { url: "https://storage.example.test", fields: { key: "signed" } };
    }),
  };
});

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: mocks.createPresignedPost,
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
vi.mock("@/models/Task", () => ({ Task: { findOne: mocks.findTask } }));

import { POST } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const projectId = "507f1f77bcf86cd799439002";
const taskId = "507f1f77bcf86cd799439003";
const managerId = "507f1f77bcf86cd799439004";
const developerId = "507f1f77bcf86cd799439005";

function id(value: string) {
  return { toString: () => value };
}

function uploadRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/uploads/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      taskId,
      fileName: "planning.png",
      contentType: "image/png",
      size: 1024,
      ...overrides,
    }),
  });
}

describe("POST /api/uploads/presign", () => {
  beforeEach(() => {
    mocks.values.context = { userId: managerId, workspaceId, role: "project_manager" };
    mocks.values.task = {
      _id: id(taskId),
      workspaceId: id(workspaceId),
      projectId: id(projectId),
      assigneeId: id(developerId),
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
    vi.clearAllMocks();
  });

  it("requires authentication before task lookup", async () => {
    mocks.values.context = null;

    const response = await POST(uploadRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(mocks.findTask).not.toHaveBeenCalled();
  });

  it("does not issue a presign for a task outside the workspace", async () => {
    mocks.values.task = null;

    const response = await POST(uploadRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(mocks.findTask).toHaveBeenCalledWith(
      expect.objectContaining({ _id: taskId, workspaceId }),
    );
    expect(mocks.getAccess).not.toHaveBeenCalled();
    expect(mocks.createPresignedPost).not.toHaveBeenCalled();
  });

  it("denies a status-only task editor attachment access", async () => {
    mocks.values.context = { userId: developerId, workspaceId, role: "developer" };
    mocks.values.task = {
      ...mocks.values.task,
      assigneeId: id(developerId),
    };
    mocks.values.access = {
      project: {
        _id: id(projectId),
        workspaceId: id(workspaceId),
        projectManagerId: id(managerId),
      },
      isProjectMember: true,
    };

    const response = await POST(uploadRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mocks.createPresignedPost).not.toHaveBeenCalled();
  });

  it("scopes the signed key and policy to the authorized task, MIME type, and exact size", async () => {
    const response = await POST(uploadRequest());
    const body = await response.json();
    const [client, options] = mocks.createPresignedPost.mock.calls[0] ?? [];

    expect(response.status).toBe(201);
    expect(body.data.storageKey).toMatch(
      new RegExp(`^${workspaceId}/${projectId}/tasks/${taskId}/[0-9a-f-]{36}$`, "i"),
    );
    expect(body.data.uploadUrl).toBe("https://storage.example.test");
    expect(client).toBe(mocks.getStorageClient.mock.results[0]?.value.client);
    expect(options).toMatchObject({
      Bucket: "private-bucket",
      Key: body.data.storageKey,
      Fields: { "Content-Type": "image/png" },
      Conditions: [
        ["eq", "$Content-Type", "image/png"],
        ["content-length-range", 1024, 1024],
      ],
    });
  });
});
