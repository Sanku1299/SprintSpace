import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    users: Array<{ _id: string }>;
    memberships: Array<{ userId: { toString(): string } }>;
    parents: Map<string, { parentTaskId?: { toString(): string } | null }>;
  } = { users: [], memberships: [], parents: new Map() };

  const userQuery = {
    select: vi.fn(() => userQuery),
    lean: vi.fn(async () => values.users),
  };
  const membershipQuery = {
    select: vi.fn(() => membershipQuery),
    lean: vi.fn(async () => values.memberships),
  };

  return {
    values,
    userQuery,
    membershipQuery,
    findUsers: vi.fn(() => userQuery),
    findMemberships: vi.fn(() => membershipQuery),
    findParent: vi.fn((filter: { _id: string }) => ({
      select: vi.fn(async () => values.parents.get(filter._id) ?? null),
    })),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/workspace-scope", () => ({
  workspaceScopedFilter: (context: { workspaceId: string }, filter: Record<string, unknown>) => ({
    ...filter,
    workspaceId: context.workspaceId,
  }),
}));
vi.mock("@/models/User", () => ({ User: { find: mocks.findUsers } }));
vi.mock("@/models/ProjectMember", () => ({ ProjectMember: { find: mocks.findMemberships } }));
vi.mock("@/models/Task", () => ({ Task: { findOne: mocks.findParent } }));

import { validateTaskReferences } from "./validate-task-references";

const context = { userId: "user-1", workspaceId: "workspace-1", role: "admin" } as const;
const projectId = "507f1f77bcf86cd799439001";
const taskId = "507f1f77bcf86cd799439002";
const parentId = "507f1f77bcf86cd799439003";
const editorId = "507f1f77bcf86cd799439004";

describe("validateTaskReferences", () => {
  beforeEach(() => {
    mocks.values.users = [];
    mocks.values.memberships = [];
    mocks.values.parents = new Map();
    mocks.findUsers.mockClear();
    mocks.findMemberships.mockClear();
    mocks.findParent.mockClear();
  });

  it("rejects a self-parent reference when the route id uses uppercase hex", async () => {
    const result = await validateTaskReferences({
      context,
      projectId,
      taskId: taskId.toUpperCase(),
      parentTaskId: taskId,
    });

    expect(result).toBe("A task cannot be its own parent.");
    expect(mocks.findParent).not.toHaveBeenCalled();
  });

  it("rejects an ancestor that would create a parent cycle", async () => {
    mocks.values.parents.set(parentId, { parentTaskId: { toString: () => taskId } });

    const result = await validateTaskReferences({
      context,
      projectId,
      taskId,
      parentTaskId: parentId,
    });

    expect(result).toBe("A task cannot be its own parent.");
    expect(mocks.findParent).toHaveBeenCalledTimes(1);
  });

  it("requires assignees and additional editors to be active workspace Developers or Designers and project members", async () => {
    mocks.values.users = [{ _id: editorId }];
    mocks.values.memberships = [{ userId: { toString: () => editorId } }];

    await expect(
      validateTaskReferences({
        context,
        projectId,
        assigneeId: editorId,
        allowedEditorIds: [editorId],
      }),
    ).resolves.toBeNull();

    mocks.values.memberships = [];
    await expect(
      validateTaskReferences({ context, projectId, allowedEditorIds: [editorId] }),
    ).resolves.toBe("Assignees and additional editors must be members of this project.");

    mocks.values.users = [];
    await expect(
      validateTaskReferences({ context, projectId, assigneeId: editorId }),
    ).resolves.toBe(
      "Assignees and additional editors must be active Developers or Designers in this workspace.",
    );
  });

  it("rejects a parent task outside the same project and workspace", async () => {
    await expect(
      validateTaskReferences({ context, projectId, parentTaskId: parentId }),
    ).resolves.toBe("Parent task must belong to this project and workspace.");
  });
});
