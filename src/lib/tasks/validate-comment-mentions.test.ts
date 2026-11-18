import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    users: Array<{ _id: { toString(): string }; role: string }>;
    memberships: Array<{ userId: { toString(): string } }>;
  } = { users: [], memberships: [] };
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
  };
});

vi.mock("@/lib/auth/workspace-scope", () => ({
  workspaceScopedFilter: (context: { workspaceId: string }, filter: Record<string, unknown>) => ({
    ...filter,
    workspaceId: context.workspaceId,
  }),
}));
vi.mock("@/models/ProjectMember", () => ({ ProjectMember: { find: mocks.findMemberships } }));
vi.mock("@/models/User", () => ({ User: { find: mocks.findUsers } }));

import { validateCommentMentions } from "./validate-comment-mentions";

const context = { userId: "author", workspaceId: "workspace-a", role: "developer" as const };
const projectId = "507f1f77bcf86cd799439001";
const projectManagerId = "507f1f77bcf86cd799439002";
const adminId = "507f1f77bcf86cd799439003";
const memberId = "507f1f77bcf86cd799439004";
const outsiderId = "507f1f77bcf86cd799439005";

function id(value: string) {
  return { toString: () => value };
}

describe("validateCommentMentions", () => {
  beforeEach(() => {
    mocks.values.users = [];
    mocks.values.memberships = [];
    mocks.findUsers.mockClear();
    mocks.findMemberships.mockClear();
  });

  it("allows active Admins, the responsible PM, and project members", async () => {
    mocks.values.users = [
      { _id: id(adminId), role: "admin" },
      { _id: id(projectManagerId), role: "project_manager" },
      { _id: id(memberId), role: "designer" },
    ];
    mocks.values.memberships = [{ userId: id(memberId) }];

    const result = await validateCommentMentions({
      context,
      projectId,
      projectManagerId,
      mentionIds: [adminId, projectManagerId, memberId],
    });

    expect(result).toBeNull();
    expect(mocks.findUsers).toHaveBeenCalledWith({
      _id: { $in: [adminId, projectManagerId, memberId] },
      status: "active",
      workspaceId: context.workspaceId,
    });
    expect(mocks.findMemberships).toHaveBeenCalledWith({
      projectId,
      userId: { $in: [memberId] },
      workspaceId: context.workspaceId,
    });
  });

  it("rejects users outside the workspace even if their role grants project-wide access", async () => {
    // The workspace-scoped User query does not return the foreign Admin.
    mocks.values.users = [];

    const result = await validateCommentMentions({
      context,
      projectId,
      projectManagerId,
      mentionIds: [outsiderId],
    });

    expect(result).toMatch(/active members in this workspace/);
    expect(mocks.findUsers).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: context.workspaceId }),
    );
    expect(mocks.findMemberships).not.toHaveBeenCalled();
  });

  it("rejects another PM and nonmembers", async () => {
    mocks.values.users = [
      { _id: id(outsiderId), role: "project_manager" },
      { _id: id(memberId), role: "designer" },
    ];

    const result = await validateCommentMentions({
      context,
      projectId,
      projectManagerId,
      mentionIds: [outsiderId, memberId],
    });

    expect(result).toMatch(/members of this project/);
    expect(mocks.findMemberships).toHaveBeenCalledWith({
      projectId,
      userId: { $in: [outsiderId, memberId] },
      workspaceId: context.workspaceId,
    });
  });
});
