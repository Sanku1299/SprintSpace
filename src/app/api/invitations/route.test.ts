import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    existingUser: unknown;
    existingInvitation: unknown;
  } = { context: null, existingUser: null, existingInvitation: null };

  return {
    values,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    findUser: vi.fn(() => ({ select: vi.fn(async () => values.existingUser) })),
    findInvitation: vi.fn(() => ({ select: vi.fn(async () => values.existingInvitation) })),
    createInvitation: vi.fn(async (document: Record<string, unknown>) => ({
      ...document,
      _id: { toString: () => "invitation-id" },
    })),
  };
});

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: state.getContext }));
vi.mock("@/lib/db/mongoose", () => ({ connectToDatabase: state.connect }));
vi.mock("@/models/User", () => ({ User: { findOne: state.findUser } }));
vi.mock("@/models/Invitation", () => ({
  Invitation: { findOne: state.findInvitation, create: state.createInvitation },
}));

import { POST } from "./route";

const admin = { userId: "admin-id", workspaceId: "workspace-id", role: "admin" };

function request(body: unknown): Request {
  return new Request("http://localhost/api/invitations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/invitations", () => {
  beforeEach(() => {
    state.values.context = admin;
    state.values.existingUser = null;
    state.values.existingInvitation = null;
  });

  it("requires an Admin", async () => {
    state.values.context = { ...admin, role: "developer" };

    const response = await POST(request({ email: "person@example.com", role: "developer" }));

    expect(response.status).toBe(403);
    expect(state.createInvitation).not.toHaveBeenCalled();
  });

  it("rejects account emails and duplicate pending invites", async () => {
    state.values.existingUser = { _id: "existing" };
    const existingAccountResponse = await POST(
      request({ email: "person@example.com", role: "developer" }),
    );
    expect(existingAccountResponse.status).toBe(409);

    state.values.existingUser = null;
    state.values.existingInvitation = { _id: "pending" };
    const pendingResponse = await POST(request({ email: "person@example.com", role: "developer" }));
    expect(pendingResponse.status).toBe(409);
    expect(state.createInvitation).not.toHaveBeenCalled();
  });

  it("stores only a token hash and returns a seven-day invite token to the Admin", async () => {
    const before = Date.now();
    const response = await POST(
      request({ email: "  PERSON@Example.com  ", name: " Pat Person ", role: "developer" }),
    );
    const body = await response.json();
    const saved = state.createInvitation.mock.calls[0]?.[0];

    expect(response.status).toBe(201);
    expect(body.data.invitation.email).toBe("person@example.com");
    expect(body.data.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(saved?.tokenHash).toMatch(/^[a-f\d]{64}$/);
    expect(saved?.tokenHash).not.toBe(body.data.token);
    expect(saved?.workspaceId).toBe("workspace-id");
    expect(saved?.invitedBy).toBe("admin-id");
    const expirationDelta = new Date(String(saved?.expiresAt)).getTime() - before;
    expect(expirationDelta).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 1000);
    expect(expirationDelta).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000);
  });
});
