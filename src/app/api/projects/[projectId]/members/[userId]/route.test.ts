import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    project: Record<string, unknown> | null;
    deletedCount: number;
  } = { context: null, project: null, deletedCount: 1 };

  const projectQuery = {
    select: vi.fn(() => ({
      then: (resolve: (result: unknown) => unknown, reject?: (error: unknown) => unknown) =>
        Promise.resolve(values.project).then(resolve, reject),
    })),
  };

  return {
    values,
    projectQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    findProject: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return projectQuery;
    }),
    deleteMembership: vi.fn(async (filter: Record<string, unknown>) => {
      void filter;
      return { deletedCount: values.deletedCount };
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
vi.mock("@/models/Project", () => ({ Project: { findOne: mocks.findProject } }));
vi.mock("@/models/ProjectMember", () => ({ ProjectMember: { deleteOne: mocks.deleteMembership } }));

import { DELETE } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const adminId = "507f1f77bcf86cd799439002";
const projectId = "507f1f77bcf86cd799439003";
const memberId = "507f1f77bcf86cd799439004";
const admin = { userId: adminId, workspaceId, role: "admin" };

function project() {
  return {
    _id: { toString: () => projectId },
    workspaceId: { toString: () => workspaceId },
    projectManagerId: { toString: () => "507f1f77bcf86cd799439005" },
  };
}

function routeContext(projectParam = projectId, userParam = memberId) {
  return { params: Promise.resolve({ projectId: projectParam, userId: userParam }) };
}

describe("DELETE /api/projects/:projectId/members/:userId", () => {
  beforeEach(() => {
    mocks.values.context = admin;
    mocks.values.project = project();
    mocks.values.deletedCount = 1;
  });

  it("removes a member only through a workspace-scoped project and membership filter", async () => {
    const response = await DELETE(new Request("http://localhost"), routeContext());
    const [projectFilter] = mocks.findProject.mock.calls[0] ?? [];
    const [membershipFilter] = mocks.deleteMembership.mock.calls[0] ?? [];

    expect(response.status).toBe(200);
    expect(projectFilter).toEqual({ _id: projectId, workspaceId });
    expect(membershipFilter).toMatchObject({ userId: memberId, workspaceId });
    expect(String(membershipFilter?.projectId)).toBe(projectId);
  });

  it("does not delete membership for a project outside the current workspace", async () => {
    mocks.values.project = null;

    const response = await DELETE(new Request("http://localhost"), routeContext());

    expect(response.status).toBe(404);
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  it("allows only the responsible Project Manager to remove a member", async () => {
    mocks.values.context = { ...admin, role: "project_manager" };

    const response = await DELETE(new Request("http://localhost"), routeContext());

    expect(response.status).toBe(404);
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  it("returns not found when the target user is not a project member", async () => {
    mocks.values.deletedCount = 0;

    const response = await DELETE(new Request("http://localhost"), routeContext());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("MEMBER_NOT_FOUND");
  });
});
