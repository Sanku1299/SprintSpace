import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    project: Record<string, unknown> | null;
    user: Record<string, unknown> | null;
    memberships: Array<Record<string, unknown>>;
    users: Array<Record<string, unknown>>;
    availableUsers: Array<Record<string, unknown>>;
    createError: unknown;
  } = {
    context: null,
    project: null,
    user: null,
    memberships: [],
    users: [],
    availableUsers: [],
    createError: null,
  };

  const membershipQuery = {
    select: vi.fn(() => membershipQuery),
    sort: vi.fn(() => membershipQuery),
    lean: vi.fn(async () => values.memberships),
  };
  const userQuery = (rows: Array<Record<string, unknown>>) => ({
    select: vi.fn(() => ({
      sort: vi.fn(() => ({ lean: async () => rows })),
      lean: async () => rows,
    })),
  });
  const projectQuery = {
    select: vi.fn(() => ({
      then: (resolve: (result: unknown) => unknown, reject?: (error: unknown) => unknown) =>
        Promise.resolve(values.project).then(resolve, reject),
    })),
  };

  return {
    values,
    membershipQuery,
    projectQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    findProject: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return projectQuery;
    }),
    findMemberships: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return membershipQuery;
    }),
    findMember: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return { select: vi.fn(() => ({ lean: async () => null })) };
    }),
    findUsers: vi.fn((filter: Record<string, unknown>) => {
      const idFilter = filter._id as Record<string, unknown> | undefined;
      return userQuery(idFilter && "$in" in idFilter ? values.users : values.availableUsers);
    }),
    findUser: vi.fn((filter: Record<string, unknown>) => {
      void filter;
      return { select: vi.fn(async () => values.user) };
    }),
    createMembership: vi.fn(async (document: Record<string, unknown>) => {
      if (values.createError) throw values.createError;
      return {
        ...document,
        addedBy: { toString: () => "507f1f77bcf86cd799439002" },
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      };
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
vi.mock("@/models/ProjectMember", () => ({
  ProjectMember: {
    find: mocks.findMemberships,
    findOne: mocks.findMember,
    create: mocks.createMembership,
  },
}));
vi.mock("@/models/User", () => ({ User: { find: mocks.findUsers, findOne: mocks.findUser } }));

import { GET, POST } from "./route";

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

function memberUser() {
  return {
    _id: { toString: () => memberId },
    name: "Dee Developer",
    email: "dee@example.com",
    role: "developer",
    status: "active",
    avatarUrl: undefined,
  };
}

function routeContext() {
  return { params: Promise.resolve({ projectId }) };
}

function request(body: unknown): Request {
  return new Request(`http://localhost/api/projects/${projectId}/members`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/projects/:projectId/members", () => {
  beforeEach(() => {
    mocks.values.context = admin;
    mocks.values.project = project();
    mocks.values.user = memberUser();
    mocks.values.memberships = [];
    mocks.values.users = [];
    mocks.values.availableUsers = [];
    mocks.values.createError = null;
  });

  it("lists roster and eligible users using workspace-scoped project memberships", async () => {
    const member = memberUser();
    mocks.values.memberships = [
      {
        userId: { toString: () => memberId },
        addedBy: { toString: () => adminId },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    mocks.values.users = [member];
    mocks.values.availableUsers = [
      { ...member, _id: { toString: () => "507f1f77bcf86cd799439006" } },
    ];

    const response = await GET(
      new Request(`http://localhost/api/projects/${projectId}/members?available=true`),
      routeContext(),
    );
    const body = await response.json();
    const [membershipFilter] = mocks.findMemberships.mock.calls[0] ?? [];
    const availableCall = mocks.findUsers.mock.calls[1];

    expect(response.status).toBe(200);
    expect(membershipFilter).toMatchObject({ workspaceId });
    expect(String(membershipFilter?.projectId)).toBe(projectId);
    expect(availableCall?.[0]).toMatchObject({
      workspaceId,
      role: { $in: ["developer", "designer"] },
      status: "active",
    });
    expect(body.data.members).toHaveLength(1);
    expect(body.data.availableMembers).toHaveLength(1);
  });

  it("adds an active workspace Developer and records trusted workspace and actor IDs", async () => {
    const response = await POST(request({ userId: memberId }), routeContext());
    const body = await response.json();
    const [userFilter] = mocks.findUser.mock.calls[0] ?? [];
    const [document] = mocks.createMembership.mock.calls[0] ?? [];

    expect(response.status).toBe(201);
    expect(userFilter).toEqual({
      _id: memberId,
      role: { $in: ["developer", "designer"] },
      status: "active",
      workspaceId,
    });
    expect(document).toMatchObject({ workspaceId, addedBy: adminId });
    expect(String(document?.projectId)).toBe(projectId);
    expect(String(document?.userId)).toBe(memberId);
    expect(body.data.member.id).toBe(memberId);
  });

  it("rejects PMs who do not own the project", async () => {
    mocks.values.context = { ...admin, role: "project_manager" };

    const response = await POST(request({ userId: memberId }), routeContext());

    expect(response.status).toBe(404);
    expect(mocks.findUser).not.toHaveBeenCalled();
    expect(mocks.createMembership).not.toHaveBeenCalled();
  });

  it("maps a concurrent add to the unique membership index to a conflict", async () => {
    mocks.values.createError = {
      code: 11000,
      keyPattern: { workspaceId: 1, projectId: 1, userId: 1 },
    };

    const response = await POST(request({ userId: memberId }), routeContext());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("PROJECT_MEMBER_ALREADY_EXISTS");
  });
});
