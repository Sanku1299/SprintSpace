import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    notifications: Array<Record<string, unknown>>;
    updatedNotification: Record<string, unknown> | null;
    memberProjectIds: unknown[];
    managedProjectIds: unknown[];
  } = {
    context: null,
    notifications: [],
    updatedNotification: null,
    memberProjectIds: [],
    managedProjectIds: [],
  };
  const notificationQuery = {
    select: vi.fn(() => notificationQuery),
    sort: vi.fn(() => notificationQuery),
    limit: vi.fn(() => notificationQuery),
    lean: vi.fn(async () => values.notifications),
  };
  const updateQuery = {
    select: vi.fn(() => updateQuery),
    lean: vi.fn(async () => values.updatedNotification),
  };
  return {
    values,
    notificationQuery,
    updateQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    findNotifications: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return notificationQuery;
    }),
    updateMany: vi.fn(async (_filter: Record<string, unknown>) => undefined),
    findAndUpdate: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return updateQuery;
    }),
    findMembers: vi.fn((_filter: Record<string, unknown>) => ({
      distinct: vi.fn(() => ({ exec: async () => values.memberProjectIds })),
    })),
    findProjects: vi.fn((_filter: Record<string, unknown>) => ({
      distinct: vi.fn(() => ({ exec: async () => values.managedProjectIds })),
    })),
    findTask: vi.fn(() => ({ select: vi.fn(() => ({ lean: async () => null })) })),
    findProject: vi.fn(() => ({ select: vi.fn(() => ({ lean: async () => null })) })),
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
vi.mock("@/models/Notification", () => ({
  Notification: {
    find: mocks.findNotifications,
    updateMany: mocks.updateMany,
    findOneAndUpdate: mocks.findAndUpdate,
  },
}));
vi.mock("@/models/ProjectMember", () => ({ ProjectMember: { find: mocks.findMembers } }));
vi.mock("@/models/Project", () => ({
  Project: { find: mocks.findProjects, findOne: mocks.findProject },
}));
vi.mock("@/models/Task", () => ({ Task: { findOne: mocks.findTask } }));

import { GET, PATCH } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const userId = "507f1f77bcf86cd799439002";
const projectId = "507f1f77bcf86cd799439003";
const notificationId = "507f1f77bcf86cd799439004";

function notificationRequest(body: unknown) {
  return new Request("http://localhost/api/notifications", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("notification tenant and project access", () => {
  beforeEach(() => {
    mocks.values.context = { userId, workspaceId, role: "developer" };
    mocks.values.notifications = [];
    mocks.values.updatedNotification = null;
    mocks.values.memberProjectIds = [projectId];
    mocks.values.managedProjectIds = [];
    vi.clearAllMocks();
  });

  it("lists only recipient notifications in projects where current membership exists", async () => {
    const response = await GET();
    const [filter] = mocks.findNotifications.mock.calls[0] ?? [];
    expect(response.status).toBe(200);
    expect(filter).toEqual({
      recipientId: userId,
      projectId: { $in: [projectId] },
      workspaceId,
    });
    expect(mocks.findMembers).toHaveBeenCalledWith({ userId, workspaceId });
  });

  it("scopes mark-all-read to current project access and tenant", async () => {
    const response = await PATCH(notificationRequest({ markAllRead: true }));
    const [filter] = mocks.updateMany.mock.calls[0] ?? [];
    expect(response.status).toBe(200);
    expect(filter).toMatchObject({
      recipientId: userId,
      projectId: { $in: [projectId] },
      workspaceId,
      readAt: null,
    });
  });

  it("rejects individual read mutation when the project membership was revoked", async () => {
    mocks.values.memberProjectIds = [];
    const response = await PATCH(notificationRequest({ notificationId }));
    const body = await response.json();
    const [filter] = mocks.findAndUpdate.mock.calls[0] ?? [];
    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(filter).toMatchObject({
      _id: notificationId,
      recipientId: userId,
      projectId: { $in: [] },
      workspaceId,
      readAt: null,
    });
  });

  it("allows Admin access across projects inside the current workspace", async () => {
    mocks.values.context = { userId, workspaceId, role: "admin" };
    await GET();
    const [filter] = mocks.findNotifications.mock.calls[0] ?? [];
    expect(filter).toEqual({ recipientId: userId, workspaceId });
    expect(mocks.findMembers).not.toHaveBeenCalled();
  });
});
