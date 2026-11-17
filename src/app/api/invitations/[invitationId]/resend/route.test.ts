import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    invitation: Record<string, unknown> | null;
    existingUser: unknown;
    updatedInvitation: Record<string, unknown> | null;
    updateError: unknown;
  } = {
    context: null,
    invitation: null,
    existingUser: null,
    updatedInvitation: null,
    updateError: null,
  };

  return {
    values,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    findInvitation: vi.fn(() => ({ select: vi.fn(async () => values.invitation) })),
    findUser: vi.fn(() => ({ select: vi.fn(async () => values.existingUser) })),
    updateInvitation: vi.fn(
      (_filter: Record<string, unknown>, _update: Record<string, unknown>, _options: unknown) => ({
        select: vi.fn(async () => {
          if (values.updateError) {
            throw values.updateError;
          }

          return values.updatedInvitation;
        }),
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
vi.mock("@/lib/db/mongoose", () => ({ connectToDatabase: state.connect }));
vi.mock("@/models/Invitation", () => ({
  Invitation: { findOne: state.findInvitation, findOneAndUpdate: state.updateInvitation },
}));
vi.mock("@/models/User", () => ({ User: { findOne: state.findUser } }));

import { POST } from "./route";

const invitationId = "507f1f77bcf86cd799439011";
const context = { userId: "admin-id", workspaceId: "workspace-id", role: "admin" };

describe("POST /api/invitations/:invitationId/resend", () => {
  beforeEach(() => {
    state.values.context = context;
    state.values.invitation = {
      _id: { toString: () => invitationId },
      email: "person@example.com",
      name: "Pat Person",
      role: "developer",
      status: "pending",
    };
    state.values.existingUser = null;
    state.values.updateError = null;
    state.values.updatedInvitation = {
      _id: { toString: () => invitationId },
      email: "person@example.com",
      name: "Pat Person",
      role: "developer",
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  });

  it("rotates the token and refreshes expiration within the Admin workspace", async () => {
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ invitationId }),
    });
    const body = await response.json();
    const [filter, update] = state.updateInvitation.mock.calls[0] ?? [];
    const updateFields = update?.$set as { tokenHash: string } | undefined;

    expect(response.status).toBe(200);
    expect(filter).toMatchObject({
      _id: invitationId,
      workspaceId: "workspace-id",
      status: "pending",
    });
    expect(updateFields?.tokenHash).toMatch(/^[a-f\d]{64}$/);
    expect(updateFields?.tokenHash).not.toBe(body.data.token);
    expect(body.data.invitation.status).toBe("pending");
  });

  it("does not resend an accepted invitation", async () => {
    state.values.invitation = { ...state.values.invitation, status: "accepted" };

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ invitationId }),
    });

    expect(response.status).toBe(409);
    expect(state.updateInvitation).not.toHaveBeenCalled();
  });

  it("does not reveal invitations outside the trusted workspace", async () => {
    state.values.invitation = null;

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ invitationId }),
    });

    expect(response.status).toBe(404);
    expect(state.updateInvitation).not.toHaveBeenCalled();
  });

  it("returns a conflict when resend races with another pending invitation", async () => {
    state.values.invitation = { ...state.values.invitation, status: "expired" };
    state.values.updateError = {
      code: 11000,
      keyPattern: { workspaceId: 1, email: 1 },
    };

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ invitationId }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("INVITATION_ALREADY_PENDING");
  });
});
