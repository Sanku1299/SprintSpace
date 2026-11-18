import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    projects: Array<Record<string, unknown>>;
    memberships: Array<Record<string, unknown>>;
    projectManager: Record<string, unknown> | null;
    existingProject: Record<string, unknown> | null;
    createdProject: Record<string, unknown>;
    createError: unknown;
  } = {
    context: null,
    projects: [],
    memberships: [],
    projectManager: null,
    existingProject: null,
    createdProject: {},
    createError: null,
  };

  const projectQuery = {
    where: vi.fn(() => projectQuery),
    equals: vi.fn(() => projectQuery),
    in: vi.fn(() => projectQuery),
    select: vi.fn(() => projectQuery),
    sort: vi.fn(() => projectQuery),
    lean: vi.fn(async () => values.projects),
  };
  const membershipQuery = {
    select: vi.fn(() => membershipQuery),
    lean: vi.fn(async () => values.memberships),
  };

  return {
    values,
    projectQuery,
    membershipQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    findProjects: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return projectQuery;
    }),
    findMemberships: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return membershipQuery;
    }),
    findUser: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return { select: vi.fn(async () => values.projectManager) };
    }),
    findProject: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return { select: vi.fn(async () => values.existingProject) };
    }),
    createProject: vi.fn(async () => {
      if (values.createError) throw values.createError;
      return values.createdProject;
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
  Project: { find: mocks.findProjects, findOne: mocks.findProject, create: mocks.createProject },
}));
vi.mock("@/models/ProjectMember", () => ({ ProjectMember: { find: mocks.findMemberships } }));
vi.mock("@/models/User", () => ({ User: { findOne: mocks.findUser } }));

import { GET, POST } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const userId = "507f1f77bcf86cd799439002";
const managerId = "507f1f77bcf86cd799439003";
const projectId = "507f1f77bcf86cd799439004";
const admin = { userId, workspaceId, role: "admin" };

function project(id = projectId, overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => id },
    workspaceId: { toString: () => workspaceId },
    name: "SprintSpace Web",
    key: "WEB",
    description: "Web platform",
    status: "planning",
    priority: "medium",
    projectManagerId: { toString: () => managerId },
    createdBy: { toString: () => userId },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "SprintSpace Web",
      key: "WEB",
      description: "Web platform",
      projectManagerId: managerId,
      ...overrides,
    }),
  });
}

describe("/api/projects", () => {
  beforeEach(() => {
    mocks.values.context = admin;
    mocks.values.projects = [project()];
    mocks.values.memberships = [];
    mocks.values.projectManager = { _id: managerId };
    mocks.values.existingProject = null;
    mocks.values.createdProject = project();
    mocks.values.createError = null;
  });

  it("lists all and only projects inside the trusted workspace for Admins", async () => {
    const response = await GET();
    const [filter] = mocks.findProjects.mock.calls[0] ?? [];

    expect(response.status).toBe(200);
    expect(filter).toEqual({ workspaceId });
    expect(mocks.projectQuery.select).toHaveBeenCalled();
  });

  it("scopes a Project Manager's list to projects they own", async () => {
    mocks.values.context = { ...admin, role: "project_manager" };

    const response = await GET();
    const [filter] = mocks.findProjects.mock.calls[0] ?? [];

    expect(response.status).toBe(200);
    expect(filter).toEqual({ workspaceId });
    expect(mocks.projectQuery.where).toHaveBeenCalledWith("projectManagerId");
    expect(mocks.projectQuery.equals).toHaveBeenCalledWith(userId);
  });

  it("scopes Developer projects through workspace membership records", async () => {
    mocks.values.context = { ...admin, role: "developer" };
    mocks.values.memberships = [{ projectId }];

    const response = await GET();
    const [membershipFilter] = mocks.findMemberships.mock.calls[0] ?? [];

    expect(response.status).toBe(200);
    expect(membershipFilter).toEqual({ workspaceId, userId });
    expect(mocks.projectQuery.where).toHaveBeenCalledWith("_id");
    expect(mocks.projectQuery.in).toHaveBeenCalledWith([projectId]);
  });

  it("rejects a Project Manager trying to create a project owned by someone else", async () => {
    mocks.values.context = { ...admin, role: "project_manager" };

    const response = await POST(createRequest({ projectManagerId: managerId }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mocks.findUser).not.toHaveBeenCalled();
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("validates the manager within the trusted workspace before creating", async () => {
    mocks.values.projectManager = null;

    const response = await POST(createRequest());
    const [managerFilter] = mocks.findUser.mock.calls[0] ?? [];

    expect(response.status).toBe(400);
    expect(managerFilter).toEqual({
      _id: managerId,
      role: "project_manager",
      status: "active",
      workspaceId,
    });
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("returns a conflict when a concurrent create wins the unique project-key index", async () => {
    mocks.values.createError = { code: 11000, keyPattern: { workspaceId: 1, key: 1 } };

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("PROJECT_KEY_ALREADY_EXISTS");
  });
});
