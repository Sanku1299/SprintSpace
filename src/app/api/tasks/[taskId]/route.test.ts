import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    task: Record<string, unknown> | null;
    updatedTask: Record<string, unknown> | null;
    access: Record<string, unknown> | null;
  } = { context: null, task: null, updatedTask: null, access: null };

  const taskQuery = {
    select: vi.fn(() => taskQuery),
    lean: vi.fn(async () => values.task),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(values.task).then(resolve),
  };
  const updatedQuery = { select: vi.fn(async () => values.updatedTask) };

  return {
    values,
    taskQuery,
    updatedQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    findTask: vi.fn(() => taskQuery),
    updateTask: vi.fn(() => updatedQuery),
    getAccess: vi.fn(async () => values.access),
    validateReferences: vi.fn(async () => null),
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
vi.mock("@/lib/tasks/validate-task-references", () => ({
  validateTaskReferences: mocks.validateReferences,
}));
vi.mock("@/models/Task", () => ({
  Task: { findOne: mocks.findTask, findOneAndUpdate: mocks.updateTask },
}));

import { GET, PATCH } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const projectId = "507f1f77bcf86cd799439002";
const taskId = "507f1f77bcf86cd799439003";
const userId = "507f1f77bcf86cd799439004";
const managerId = "507f1f77bcf86cd799439005";
const designerId = "507f1f77bcf86cd799439006";

function id(value: string) {
  return { toString: () => value };
}

function task(overrides: Record<string, unknown> = {}) {
  return {
    _id: id(taskId),
    workspaceId: id(workspaceId),
    projectId: id(projectId),
    title: "Design landing page",
    description: "Prepare first draft",
    status: "todo",
    priority: "medium",
    assigneeId: id(userId),
    allowedEditorIds: [id(designerId)],
    dueDate: null,
    labels: [],
    parentTaskId: null,
    position: 0,
    createdBy: id(managerId),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

function routeContext(id = taskId) {
  return { params: Promise.resolve({ taskId: id }) };
}

function patchRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/tasks/[taskId]", () => {
  beforeEach(() => {
    mocks.values.context = { userId: managerId, workspaceId, role: "project_manager" };
    mocks.values.task = task();
    mocks.values.updatedTask = task({ status: "in_progress" });
    mocks.values.access = {
      project: {
        _id: id(projectId),
        workspaceId: id(workspaceId),
        projectManagerId: id(managerId),
      },
      isProjectMember: false,
    };
    mocks.getAccess.mockClear();
    mocks.findTask.mockClear();
    mocks.updateTask.mockClear();
    mocks.validateReferences.mockClear();
  });

  it("returns an accessible task detail", async () => {
    const response = await GET(new Request(`http://localhost/api/tasks/${taskId}`), routeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.task).toMatchObject({ id: taskId, projectId, title: "Design landing page" });
  });

  it("returns 404 when the task's project is outside the user's workspace or access scope", async () => {
    mocks.values.access = null;

    const response = await GET(new Request(`http://localhost/api/tasks/${taskId}`), routeContext());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it.each([
    { role: "developer", userId, assigneeId: id(userId) },
    { role: "designer", userId: designerId, assigneeId: id(managerId) },
  ])(
    "allows an assigned or authorized $role to update status only",
    async ({ role, userId: actor }) => {
      mocks.values.context = { userId: actor, workspaceId, role };
      mocks.values.task = task();
      mocks.values.access = {
        project: {
          _id: id(projectId),
          workspaceId: id(workspaceId),
          projectManagerId: id(managerId),
        },
        isProjectMember: true,
      };

      const response = await PATCH(patchRequest({ status: "in_progress" }), routeContext());

      expect(response.status).toBe(200);
      expect(mocks.updateTask).toHaveBeenCalled();
    },
  );

  it.each([
    { role: "developer", userId },
    { role: "designer", userId: designerId },
  ])("rejects $role updates to fields beyond status", async ({ role, userId: actor }) => {
    mocks.values.context = { userId: actor, workspaceId, role };
    mocks.values.task = task();
    mocks.values.access = {
      project: {
        _id: id(projectId),
        workspaceId: id(workspaceId),
        projectManagerId: id(managerId),
      },
      isProjectMember: true,
    };

    const response = await PATCH(patchRequest({ title: "Changed title" }), routeContext());

    expect(response.status).toBe(403);
    expect(mocks.updateTask).not.toHaveBeenCalled();
  });
});
