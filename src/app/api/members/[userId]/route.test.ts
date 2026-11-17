import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  type MemberRecord = {
    _id: { toString: () => string };
    name: string;
    email: string;
    role: string;
    status: string;
    createdAt: Date;
    passwordHash?: string;
  };

  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    member: MemberRecord | null;
  } = { context: null, member: null };

  return {
    values,
    getContext: vi.fn(async () => values.context),
    findOneAndUpdate: vi.fn(
      (_filter: Record<string, unknown>, _update: Record<string, unknown>, _options: unknown) => ({
        select: vi.fn(async () => values.member),
      }),
    ),
  };
});

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: state.getContext }));
vi.mock("@/lib/auth/workspace-scope", () => ({
  workspaceScopedFilter: (context: { workspaceId: string }, filter: Record<string, unknown>) => ({
    ...filter,
    workspaceId: context.workspaceId,
  }),
}));
vi.mock("@/models/User", () => ({
  USER_ROLES: ["admin", "project_manager", "developer", "designer"],
  User: { findOneAndUpdate: state.findOneAndUpdate },
}));

import { PATCH } from "./route";

const userId = "507f1f77bcf86cd799439011";
const admin = { userId: "507f1f77bcf86cd799439099", workspaceId: "workspace-a", role: "admin" };

function request(body: unknown): Request {
  return new Request(`http://localhost/api/members/${userId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function routeContext(id = userId) {
  return { params: Promise.resolve({ userId: id }) };
}

describe("PATCH /api/members/:userId", () => {
  beforeEach(() => {
    state.values.context = admin;
    state.values.member = {
      _id: { toString: () => userId },
      name: "Pat Person",
      email: "person@example.com",
      role: "project_manager",
      status: "active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      passwordHash: "must-not-be-returned",
    };
  });

  it("updates the role using the trusted workspace and returns safe member data", async () => {
    const response = await PATCH(request({ role: "project_manager" }), routeContext());
    const body = await response.json();
    const [filter, update, options] = state.findOneAndUpdate.mock.calls[0] ?? [];

    expect(response.status).toBe(200);
    expect(filter).toEqual({ _id: userId, workspaceId: "workspace-a" });
    expect(update).toEqual({ $set: { role: "project_manager" } });
    expect(options).toMatchObject({ new: true, runValidators: true });
    expect(body.data.member).toMatchObject({
      id: userId,
      name: "Pat Person",
      email: "person@example.com",
      role: "project_manager",
    });
    expect(JSON.stringify(body)).not.toContain("must-not-be-returned");
  });

  it("requires an authenticated Admin", async () => {
    state.values.context = { ...admin, role: "developer" };

    const response = await PATCH(request({ role: "designer" }), routeContext());

    expect(response.status).toBe(403);
    expect(state.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    state.values.context = null;

    const response = await PATCH(request({ role: "designer" }), routeContext());

    expect(response.status).toBe(401);
    expect(state.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("does not allow an Admin to change their own role", async () => {
    state.values.context = { ...admin, userId };

    const response = await PATCH(request({ role: "developer" }), routeContext());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("SELF_ROLE_CHANGE_NOT_ALLOWED");
    expect(state.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("returns not found when the member is outside the trusted workspace", async () => {
    state.values.member = null;

    const response = await PATCH(request({ role: "designer" }), routeContext());
    const [filter] = state.findOneAndUpdate.mock.calls[0] ?? [];

    expect(response.status).toBe(404);
    expect(filter).toEqual({ _id: userId, workspaceId: "workspace-a" });
  });

  it("rejects invalid roles and client-supplied workspace fields", async () => {
    const invalidRoleResponse = await PATCH(request({ role: "owner" }), routeContext());
    const injectedWorkspaceResponse = await PATCH(
      request({ role: "designer", workspaceId: "workspace-b" }),
      routeContext(),
    );

    expect(invalidRoleResponse.status).toBe(400);
    expect(injectedWorkspaceResponse.status).toBe(400);
    expect(state.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
