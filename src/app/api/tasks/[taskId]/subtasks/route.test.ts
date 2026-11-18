import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    parent: Record<string, unknown> | null;
    access: Record<string, unknown> | null;
    subtasks: Array<Record<string, unknown>>;
    createdSubtask: Record<string, unknown>;
    referenceError: string | null;
  } = {
    context: null,
    parent: null,
    access: null,
    subtasks: [],
    createdSubtask: {},
    referenceError: null,
  };
  const parentQuery = { select: vi.fn(async () => values.parent) };
  const subtaskQuery = {
    select: vi.fn(() => subtaskQuery),
    sort: vi.fn(() => subtaskQuery),
    lean: vi.fn(async () => values.subtasks),
  };
  const taskActivityChanges = vi.fn(
    (previous: Record<string, unknown>, next: Record<string, unknown>) =>
      Object.entries(next).map(([field, to]) => ({ field, from: previous[field] ?? null, to })),
  );
  return {
    values,
    parentQuery,
    subtaskQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    getAccess: vi.fn(async () => values.access),
    findParent: vi.fn(() => parentQuery),
    findSubtasks: vi.fn(() => subtaskQuery),
    createTask: vi.fn(async () => values.createdSubtask),
    validateReferences: vi.fn(async () => values.referenceError),
    recordTaskActivity: vi.fn(async (_activity: Record<string, unknown>) => {
      void _activity;
    }),
    taskActivityChanges,
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
vi.mock("@/lib/tasks/task-activity", () => ({
  recordTaskActivity: mocks.recordTaskActivity,
  taskActivityChanges: mocks.taskActivityChanges,
}));
vi.mock("@/models/Task", () => ({
  Task: { findOne: mocks.findParent, find: mocks.findSubtasks, create: mocks.createTask },
}));

import { GET, POST } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const projectId = "507f1f77bcf86cd799439002";
const parentId = "507f1f77bcf86cd799439003";
const subtaskId = "507f1f77bcf86cd799439004";
const managerId = "507f1f77bcf86cd799439005";

function id(value: string) {
  return { toString: () => value };
}

function parent() {
  return { _id: id(parentId), projectId: id(projectId) };
}

function subtask() {
  return {
    _id: id(subtaskId),
    workspaceId: id(workspaceId),
    projectId: id(projectId),
    title: "Check mobile layout",
    description: "",
    status: "todo",
    priority: "medium",
    assigneeId: null,
    allowedEditorIds: [],
    dueDate: null,
    labels: [],
    parentTaskId: id(parentId),
    position: 0,
    createdBy: id(managerId),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function routeContext(id = parentId) {
  return { params: Promise.resolve({ taskId: id }) };
}

function postRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/tasks/${parentId}/subtasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/tasks/[taskId]/subtasks", () => {
  beforeEach(() => {
    mocks.values.context = { userId: managerId, workspaceId, role: "project_manager" };
    mocks.values.parent = parent();
    mocks.values.access = { project: { _id: id(projectId) }, isProjectMember: false };
    mocks.values.subtasks = [subtask()];
    mocks.values.createdSubtask = subtask();
    mocks.values.referenceError = null;
    mocks.getAccess.mockClear();
    mocks.findParent.mockClear();
    mocks.findSubtasks.mockClear();
    mocks.createTask.mockClear();
    mocks.validateReferences.mockClear();
    mocks.recordTaskActivity.mockClear();
    mocks.taskActivityChanges.mockClear();
  });

  it("lists subtasks for an accessible parent", async () => {
    const response = await GET(new Request("http://localhost/subtasks"), routeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.subtasks).toHaveLength(1);
    expect(body.data.subtasks[0].parentTaskId).toBe(parentId);
  });

  it("does not list subtasks when the parent is not available in the workspace", async () => {
    mocks.values.parent = null;

    const response = await GET(new Request("http://localhost/subtasks"), routeContext());

    expect(response.status).toBe(404);
    expect(mocks.findSubtasks).not.toHaveBeenCalled();
  });

  it("creates a subtask under the accessible parent task", async () => {
    const response = await POST(postRequest({ title: "Check mobile layout" }), routeContext());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.subtask.id).toBe(subtaskId);
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        projectId: expect.anything(),
        parentTaskId: expect.anything(),
      }),
    );
    expect(mocks.recordTaskActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        context: mocks.values.context,
        projectId: mocks.values.createdSubtask.projectId as unknown,
        taskId: mocks.values.createdSubtask._id,
        type: "task_created",
        changes: expect.arrayContaining([
          { field: "title", from: null, to: "Check mobile layout" },
        ]),
      }),
    );
  });

  it("rejects a subtask if the parent project is outside the current user's access", async () => {
    mocks.values.access = null;

    const response = await POST(postRequest({ title: "Check mobile layout" }), routeContext());

    expect(response.status).toBe(404);
    expect(mocks.createTask).not.toHaveBeenCalled();
  });
});
