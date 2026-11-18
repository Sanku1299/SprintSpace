import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    task: Record<string, unknown> | null;
    access: Record<string, unknown> | null;
    activities: Array<Record<string, unknown>>;
    actors: Array<Record<string, unknown>>;
  } = { context: null, task: null, access: null, activities: [], actors: [] };
  const taskQuery = {
    select: vi.fn(() => taskQuery),
    lean: vi.fn(async () => values.task),
  };
  const activityQuery = {
    select: vi.fn(() => activityQuery),
    sort: vi.fn(() => activityQuery),
    limit: vi.fn(() => activityQuery),
    lean: vi.fn(async () => values.activities),
  };
  const actorQuery = {
    select: vi.fn(() => actorQuery),
    lean: vi.fn(async () => values.actors),
  };

  return {
    values,
    taskQuery,
    activityQuery,
    actorQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    getAccess: vi.fn(async () => values.access),
    findTask: vi.fn(() => taskQuery),
    findActivities: vi.fn(() => activityQuery),
    findActors: vi.fn(() => actorQuery),
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
vi.mock("@/lib/tasks/task-project-access", () => ({
  getAccessibleTaskProject: mocks.getAccess,
}));
vi.mock("@/models/Task", () => ({ Task: { findOne: mocks.findTask } }));
vi.mock("@/models/TaskActivity", () => ({
  TaskActivity: { find: mocks.findActivities },
}));
vi.mock("@/models/User", () => ({ User: { find: mocks.findActors } }));

import { GET } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const projectId = "507f1f77bcf86cd799439002";
const taskId = "507f1f77bcf86cd799439003";
const actorId = "507f1f77bcf86cd799439004";

function id(value: string) {
  return { toString: () => value };
}

function routeContext() {
  return { params: Promise.resolve({ taskId }) };
}

function request() {
  return new Request(`http://localhost/api/tasks/${taskId}/activity`);
}

describe("GET /api/tasks/[taskId]/activity", () => {
  beforeEach(() => {
    mocks.values.context = { userId: actorId, workspaceId, role: "developer" };
    mocks.values.task = { _id: id(taskId), projectId: id(projectId) };
    mocks.values.access = {
      project: { _id: id(projectId), workspaceId: id(workspaceId) },
      isProjectMember: true,
    };
    mocks.values.activities = [
      {
        _id: id("507f1f77bcf86cd799439005"),
        workspaceId: id(workspaceId),
        projectId: id(projectId),
        taskId: id(taskId),
        actorId: id(actorId),
        type: "task_status_changed",
        changes: [{ field: "status", from: "todo", to: "done" }],
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ];
    mocks.values.actors = [{ _id: id(actorId), name: "Casey Member", avatarUrl: null }];
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    mocks.values.context = null;

    const response = await GET(request(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(mocks.findTask).not.toHaveBeenCalled();
  });

  it("hides activity when the task project is outside the caller's access scope", async () => {
    mocks.values.access = null;

    const response = await GET(request(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(mocks.findActivities).not.toHaveBeenCalled();
  });

  it("returns activity and scopes task history and actor profiles to the workspace", async () => {
    const response = await GET(request(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.activities[0]).toMatchObject({
      actorId,
      actorName: "Casey Member",
      type: "task_status_changed",
    });
    expect(mocks.findActivities).toHaveBeenCalledWith({
      taskId: mocks.values.task?._id,
      projectId: (mocks.values.access?.project as { _id: unknown })._id,
      workspaceId,
    });
    expect(mocks.findActors).toHaveBeenCalledWith({ _id: { $in: [actorId] }, workspaceId });
  });
});
