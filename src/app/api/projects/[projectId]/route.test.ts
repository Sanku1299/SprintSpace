import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    project: Record<string, unknown> | null;
    updatedProject: Record<string, unknown> | null;
    membership: Record<string, unknown> | null;
    manager: Record<string, unknown> | null;
    updateError: unknown;
  } = {
    context: null,
    project: null,
    updatedProject: null,
    membership: null,
    manager: { _id: "manager-id" },
    updateError: null,
  };

  function selectQuery(value: unknown, error: unknown = null) {
    const selected = {
      lean: vi.fn(async () => {
        if (error) throw error;
        return value;
      }),
      then: (resolve: (result: unknown) => unknown, reject?: (error: unknown) => unknown) =>
        (error ? Promise.reject(error) : Promise.resolve(value)).then(resolve, reject),
    };
    return { select: vi.fn(() => selected) };
  }

  return {
    values,
    selectQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    findProject: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return selectQuery(values.project);
    }),
    updateProject: vi.fn((filter: Record<string, unknown>, update: unknown, options: unknown) => {
      void filter;
      void update;
      void options;
      // Mongoose exposes `.select()` before the query is awaited/rejected.
      return selectQuery(values.updatedProject, values.updateError);
    }),
    findMembership: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return { select: vi.fn(() => ({ lean: async () => values.membership })) };
    }),
    findManager: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return { select: vi.fn(async () => values.manager) };
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
vi.mock("@/models/Project", () => ({
  Project: { findOne: mocks.findProject, findOneAndUpdate: mocks.updateProject },
}));
vi.mock("@/models/ProjectMember", () => ({ ProjectMember: { findOne: mocks.findMembership } }));
vi.mock("@/models/User", () => ({ User: { findOne: mocks.findManager } }));

import { GET, PATCH } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const userId = "507f1f77bcf86cd799439002";
const managerId = "507f1f77bcf86cd799439003";
const projectId = "507f1f77bcf86cd799439004";
const admin = { userId, workspaceId, role: "admin" };

function project(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => projectId },
    workspaceId: { toString: () => workspaceId },
    name: "SprintSpace Web",
    key: "WEB",
    description: "Web platform",
    status: "planning",
    priority: "medium",
    projectManagerId: { toString: () => managerId },
    createdBy: { toString: () => userId },
    startDate: null,
    endDate: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

function routeContext(id = projectId) {
  return { params: Promise.resolve({ projectId: id }) };
}

function patchRequest(body: unknown): Request {
  return new Request(`http://localhost/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/projects/:projectId", () => {
  beforeEach(() => {
    mocks.values.context = admin;
    mocks.values.project = project();
    mocks.values.updatedProject = project({ status: "active" });
    mocks.values.membership = null;
    mocks.values.manager = { _id: managerId };
    mocks.values.updateError = null;
  });

  it("loads project details through a workspace-scoped ID lookup", async () => {
    const response = await GET(new Request("http://localhost"), routeContext());
    const [filter] = mocks.findProject.mock.calls[0] ?? [];
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(filter).toEqual({ _id: projectId, workspaceId });
    expect(body.data.project).toMatchObject({ id: projectId, key: "WEB" });
  });

  it("does not reveal a project ID from another workspace", async () => {
    mocks.values.project = null;

    const response = await GET(new Request("http://localhost"), routeContext());
    const body = await response.json();
    const [filter] = mocks.findProject.mock.calls[0] ?? [];

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(filter).toEqual({ _id: projectId, workspaceId });
  });

  it("allows a Developer to view only a project where they have workspace-scoped membership", async () => {
    mocks.values.context = { ...admin, role: "developer" };
    mocks.values.membership = { _id: "membership-id" };

    const response = await GET(new Request("http://localhost"), routeContext());
    const [membershipFilter] = mocks.findMembership.mock.calls[0] ?? [];

    expect(response.status).toBe(200);
    expect(membershipFilter).toEqual({ projectId, userId, workspaceId });
  });

  it("prevents a Project Manager from updating another PM's project", async () => {
    mocks.values.context = { ...admin, userId, role: "project_manager" };

    const response = await PATCH(patchRequest({ status: "active" }), routeContext());

    expect(response.status).toBe(404);
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("lets the responsible Project Manager update the project without changing ownership", async () => {
    mocks.values.context = { ...admin, userId: managerId, role: "project_manager" };

    const response = await PATCH(patchRequest({ status: "active" }), routeContext());
    const [filter, update] = mocks.updateProject.mock.calls[0] ?? [];

    expect(response.status).toBe(200);
    expect(filter).toEqual({ _id: projectId, projectManagerId: managerId, workspaceId });
    expect(update).toEqual({ $set: { status: "active" } });
  });

  it("validates Admin PM reassignment within the workspace", async () => {
    mocks.values.manager = null;

    const response = await PATCH(patchRequest({ projectManagerId: userId }), routeContext());
    const [managerFilter] = mocks.findManager.mock.calls[0] ?? [];

    expect(response.status).toBe(400);
    expect(managerFilter).toEqual({
      _id: userId,
      role: "project_manager",
      status: "active",
      workspaceId,
    });
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("maps a concurrent project-key update collision to a conflict", async () => {
    mocks.values.updateError = { code: 11000, keyPattern: { workspaceId: 1, key: 1 } };

    const response = await PATCH(patchRequest({ key: "NEW" }), routeContext());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("PROJECT_KEY_ALREADY_EXISTS");
  });
});
