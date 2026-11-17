import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  connect: vi.fn(async () => undefined),
  findById: vi.fn(),
}));

vi.mock("../../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/mongoose", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/models/User", () => ({
  USER_ROLES: ["admin", "project_manager", "developer", "designer"],
  User: { findById: mocks.findById },
}));

import { getWorkspaceContext } from "./workspace-context";

const userId = "507f1f77bcf86cd799439011";

describe("getWorkspaceContext", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({
      user: { id: userId, workspaceId: "stale-workspace", role: "admin" },
    });
    mocks.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: userId,
        workspaceId: "trusted-workspace",
        role: "developer",
        status: "active",
      }),
    });
  });

  it("uses the current workspace and role from the database, not JWT claims", async () => {
    await expect(getWorkspaceContext()).resolves.toEqual({
      userId,
      workspaceId: "trusted-workspace",
      role: "developer",
    });
    expect(mocks.findById).toHaveBeenCalledWith(userId);
  });

  it("returns null without a valid authenticated identity", async () => {
    mocks.auth.mockResolvedValueOnce(null);

    await expect(getWorkspaceContext()).resolves.toBeNull();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("rejects disabled accounts and unsupported stored roles", async () => {
    mocks.findById.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue({
        _id: userId,
        workspaceId: "trusted-workspace",
        role: "admin",
        status: "disabled",
      }),
    });
    await expect(getWorkspaceContext()).resolves.toBeNull();

    mocks.findById.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue({
        _id: userId,
        workspaceId: "trusted-workspace",
        role: "superadmin",
        status: "active",
      }),
    });
    await expect(getWorkspaceContext()).resolves.toBeNull();
  });
});
