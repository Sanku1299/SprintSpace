import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    invitation: Record<string, unknown> | null;
    revokedInvitation: Record<string, unknown> | null;
  } = { context: null, invitation: null, revokedInvitation: null };

  return {
    values,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    findInvitation: vi.fn(() => ({ select: vi.fn(async () => values.invitation) })),
    updateInvitation: vi.fn(
      (_filter: Record<string, unknown>, _update: Record<string, unknown>, _options: unknown) => ({
        select: vi.fn(async () => values.revokedInvitation),
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

import { POST } from "./route";

const invitationId = "507f1f77bcf86cd799439011";
const context = { userId: "admin-id", workspaceId: "workspace-id", role: "admin" };

describe("POST /api/invitations/:invitationId/revoke", () => {
  beforeEach(() => {
    state.values.context = context;
    state.values.invitation = { email: "person@example.com", status: "pending" };
    state.values.revokedInvitation = {
      _id: { toString: () => invitationId },
      email: "person@example.com",
      status: "revoked",
    };
  });

  it("revokes a pending invitation within the trusted workspace", async () => {
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ invitationId }),
    });
    const body = await response.json();
    const [filter, update] = state.updateInvitation.mock.calls[0] ?? [];

    expect(response.status).toBe(200);
    expect(filter).toMatchObject({
      _id: invitationId,
      workspaceId: "workspace-id",
      status: "pending",
    });
    expect(update).toEqual({ $set: { status: "revoked" } });
    expect(body.data.invitation.status).toBe("revoked");
  });

  it("does not revoke an accepted invitation", async () => {
    state.values.invitation = { email: "person@example.com", status: "accepted" };

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ invitationId }),
    });

    expect(response.status).toBe(409);
    expect(state.updateInvitation).not.toHaveBeenCalled();
  });
});
