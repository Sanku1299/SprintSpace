import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: null as null | { userId: string; workspaceId: string; role: string },
  getWorkspaceContext: vi.fn(async () => mocks.context),
  connect: vi.fn(async () => undefined),
  workspace: null as null | Record<string, unknown>,
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
}));
vi.mock("@/lib/db/mongoose", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/models/Workspace", () => ({
  Workspace: {
    findById: mocks.findById,
    findByIdAndUpdate: mocks.findByIdAndUpdate,
  },
}));

import { GET, PATCH } from "./route";

const adminContext = { userId: "user-1", workspaceId: "workspace-from-db", role: "admin" };
const workspaceDocument = {
  _id: { toString: () => "workspace-from-db" },
  name: "SprintSpace",
  slug: "sprintspace",
  description: "Team workspace",
  logo: "https://example.com/logo.png",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/workspace", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/workspace", () => {
  beforeEach(() => {
    mocks.context = adminContext;
    mocks.workspace = workspaceDocument;
    mocks.findById.mockReturnValue({
      select: () => ({ lean: async () => mocks.workspace }),
    });
    mocks.findByIdAndUpdate.mockReturnValue({
      select: () => ({ lean: async () => mocks.workspace }),
    });
  });

  it("returns workspace details scoped to the trusted workspace context", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.findById).toHaveBeenCalledWith("workspace-from-db");
    expect(body.data).toMatchObject({ id: "workspace-from-db", name: "SprintSpace" });
  });

  it("requires an authenticated Admin to read workspace details", async () => {
    mocks.context = { ...adminContext, role: "developer" };

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.findById).not.toHaveBeenCalled();
  });

  it("rejects mass-assignment fields in workspace updates", async () => {
    const response = await PATCH(patchRequest({ name: "Renamed", role: "admin" }));

    expect(response.status).toBe(400);
    expect(mocks.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("allows an Admin to update only validated fields in their workspace", async () => {
    const response = await PATCH(patchRequest({ name: "New Workspace", description: "Updated" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.findByIdAndUpdate).toHaveBeenCalledWith(
      "workspace-from-db",
      { $set: { name: "New Workspace", description: "Updated" } },
      { new: true, runValidators: true },
    );
    expect(body.data.name).toBe("SprintSpace");
  });
});
