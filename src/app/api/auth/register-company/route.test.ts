import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  type TestDocument = {
    _id: { toString: () => string };
    createdBy?: { toString: () => string };
    workspaceId?: { toString: () => string };
    email?: string;
    role?: string;
  };

  const session = {
    withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
    endSession: vi.fn(async () => undefined),
  };

  let existingUser: { _id: string } | null = null;

  const sessionLookup = vi.fn(async () => existingUser);
  const selectLookup = vi.fn(() => ({ session: sessionLookup }));

  return {
    session,
    sessionLookup,
    selectLookup,
    findOne: vi.fn(() => ({ select: selectLookup })),
    createUser: vi.fn(async (_documents: TestDocument[], _options?: unknown) => undefined),
    createWorkspace: vi.fn(async (_documents: TestDocument[], _options?: unknown) => undefined),
    connect: vi.fn(async () => ({ startSession: vi.fn(async () => session) })),
    hashPassword: vi.fn(async () => "scrypt$v1$salt$hash"),
    getExistingUser: () => existingUser,
    setExistingUser: (user: { _id: string } | null) => {
      existingUser = user;
    },
  };
});

vi.mock("@/lib/auth/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/lib/db/mongoose", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/models/User", () => ({
  User: { findOne: mocks.findOne, create: mocks.createUser },
}));
vi.mock("@/models/Workspace", () => ({ Workspace: { create: mocks.createWorkspace } }));

import { POST } from "./route";

const validPayload = {
  workspaceName: "Sprint Space",
  name: "Sam User",
  email: "SAM@example.com",
  password: "a-long-password-123",
};

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/register-company", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register-company", () => {
  beforeEach(() => {
    mocks.setExistingUser(null);
    mocks.session.withTransaction.mockImplementation(async (callback) => callback());
  });

  it("rejects invalid input before opening a database session", async () => {
    const response = await POST(jsonRequest({ ...validPayload, email: "bad" }));

    expect(response.status).toBe(400);
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
  });

  it("returns a generic conflict for a globally registered email", async () => {
    mocks.setExistingUser({ _id: "existing-user" });

    const response = await POST(jsonRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.session.endSession).toHaveBeenCalledOnce();
  });

  it("creates the workspace and first Admin in one transaction", async () => {
    const response = await POST(jsonRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.user).toMatchObject({ email: "sam@example.com", role: "admin" });
    expect(mocks.session.withTransaction).toHaveBeenCalledOnce();
    expect(mocks.createWorkspace).toHaveBeenCalledOnce();
    expect(mocks.createUser).toHaveBeenCalledOnce();

    const workspace = mocks.createWorkspace.mock.calls[0]?.[0][0];
    const user = mocks.createUser.mock.calls[0]?.[0][0];
    expect(workspace).toBeDefined();
    expect(user).toBeDefined();
    expect(workspace?.createdBy?.toString()).toBe(user?._id.toString());
    expect(user?.workspaceId?.toString()).toBe(workspace?._id.toString());
    expect(user?.role).toBe("admin");
  });

  it("returns 503 without leaking database errors when the transaction fails", async () => {
    mocks.session.withTransaction.mockRejectedValueOnce(new Error("private database detail"));

    const response = await POST(jsonRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain("private database detail");
    expect(mocks.session.endSession).toHaveBeenCalledOnce();
  });
});
