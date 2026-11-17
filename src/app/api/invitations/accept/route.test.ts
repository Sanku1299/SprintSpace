import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values = {
    existingUser: null as { _id: string } | null,
    createdUserError: null as unknown,
  };
  const session = {
    withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
    endSession: vi.fn(async () => undefined),
  };
  const invitation = {
    _id: { toString: () => "invitation-id" },
    workspaceId: { toString: () => "workspace-from-invitation" },
    email: "person@example.com",
    name: "Pat Person",
    role: "developer",
  };

  return {
    session,
    invitation,
    values,
    connect: vi.fn(async () => ({ startSession: vi.fn(async () => session) })),
    hashPassword: vi.fn(async () => "scrypt$v1$salt$hash"),
    findInvitation: vi.fn(() => ({ session: vi.fn(async () => invitation) })),
    claimInvitation: vi.fn(async () => invitation),
    findUser: vi.fn(() => ({ select: () => ({ session: async () => values.existingUser }) })),
    createUser: vi.fn(async (_documents: Record<string, unknown>[], _options?: unknown) => {
      if (values.createdUserError) {
        throw values.createdUserError;
      }
    }),
  };
});

vi.mock("@/lib/auth/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/lib/db/mongoose", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/models/Invitation", () => ({
  Invitation: { findOne: mocks.findInvitation, findOneAndUpdate: mocks.claimInvitation },
}));
vi.mock("@/models/User", () => ({ User: { findOne: mocks.findUser, create: mocks.createUser } }));

import { POST } from "./route";

const token = "a-valid-invitation-token-with-enough-entropy";

function request(body: unknown): Request {
  return new Request("http://localhost/api/invitations/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/invitations/accept", () => {
  beforeEach(() => {
    mocks.values.existingUser = null;
    mocks.values.createdUserError = null;
  });

  it("creates the invited account in the invitation workspace with its assigned role", async () => {
    const response = await POST(request({ token, password: "a-strong-password-123" }));
    const body = await response.json();
    const [documents] = mocks.createUser.mock.calls[0] ?? [];
    const createdUser = documents?.[0];

    expect(response.status).toBe(201);
    expect(body.data.user).toMatchObject({
      email: "person@example.com",
      name: "Pat Person",
      role: "developer",
    });
    expect(createdUser).toMatchObject({
      email: "person@example.com",
      name: "Pat Person",
      role: "developer",
      passwordHash: "scrypt$v1$salt$hash",
    });
    expect(createdUser?.workspaceId).toBe(mocks.invitation.workspaceId);
    expect(mocks.session.withTransaction).toHaveBeenCalledOnce();
    expect(mocks.session.endSession).toHaveBeenCalledOnce();
  });

  it("rejects an email that already belongs to an account", async () => {
    mocks.values.existingUser = { _id: "existing-user" };

    const response = await POST(request({ token, password: "a-strong-password-123" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("ACCOUNT_ALREADY_EXISTS");
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("maps a concurrent globally unique email conflict to a safe conflict response", async () => {
    mocks.values.createdUserError = { code: 11000, keyPattern: { email: 1 } };

    const response = await POST(request({ token, password: "a-strong-password-123" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("ACCOUNT_ALREADY_EXISTS");
    expect(JSON.stringify(body)).not.toContain("keyPattern");
  });
});
