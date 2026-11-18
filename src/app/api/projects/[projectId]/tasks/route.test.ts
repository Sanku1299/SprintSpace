import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    access: Record<string, unknown> | null;
    tasks: Array<Record<string, unknown>>;
    createdTask: Record<string, unknown>;
    referenceError: string | null;
  } = { context: null, access: null, tasks: [], createdTask: {}, referenceError: null };
  const taskQuery = {
    select: vi.fn(() => taskQuery),
    sort: vi.fn(() => taskQuery),
    lean: vi.fn(async () => values.tasks),
  };
  return {
    values,
    taskQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    getAccess: vi.fn(async () => values.access),
    findTasks: vi.fn(() => taskQuery),
    createTask: vi.fn(async () => values.createdTask),
    validateReferences: vi.fn(async () => values.referenceError),
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
  recordTaskActivity: vi.fn(async () => undefined),
  taskActivityChanges: vi.fn(() => []),
}));
vi.mock("@/models/Task", () => ({ Task: { find: mocks.findTasks, create: mocks.createTask } }));

import { GET, POST } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const projectId = "507f1f77bcf86cd799439002";
const userId = "507f1f77bcf86cd799439003";
const managerId = "507f1f77bcf86cd799439004";
const taskId = "507f1f77bcf86cd799439005";

function id(value: string) {
  return { toString: () => value };
}

function task() {
  return {
    _id: id(taskId),
    workspaceId: id(workspaceId),
    projectId: id(projectId),
    title: "Create task list",
    description: "",
    status: "todo",
    priority: "medium",
    assigneeId: null,
    allowedEditorIds: [],
    dueDate: null,
    labels: [],
    parentTaskId: null,
    position: 0,
    createdBy: id(userId),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function routeContext(id = projectId) {
  return { params: Promise.resolve({ projectId: id }) };
}

function postRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/projects/${projectId}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/projects/[projectId]/tasks", () => {
  beforeEach(() => {
    mocks.values.context = { userId: managerId, workspaceId, role: "project_manager" };
    mocks.values.access = {
      project: { _id: id(projectId), workspaceId: id(workspaceId) },
      isProjectMember: false,
    };
    mocks.values.tasks = [task()];
    mocks.values.createdTask = task();
    mocks.values.referenceError = null;
    mocks.getAccess.mockClear();
    mocks.findTasks.mockClear();
    mocks.createTask.mockClear();
    mocks.validateReferences.mockClear();
  });

  it("lists tasks only when the project is accessible in the current workspace", async () => {
    mocks.values.access = null;

    const response = await GET(new Request("http://localhost/tasks"), routeContext());

    expect(response.status).toBe(404);
    expect(mocks.findTasks).not.toHaveBeenCalled();
  });

  it("creates a task after validating project references", async () => {
    const response = await POST(
      postRequest({ title: "Create task list", assigneeId: userId }),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.task.id).toBe(taskId);
    expect(mocks.validateReferences).toHaveBeenCalledWith(
      expect.objectContaining({ context: mocks.values.context, projectId }),
    );
    expect(mocks.createTask).toHaveBeenCalled();
  });

  it("rejects a task reference that fails workspace or project validation", async () => {
    mocks.values.referenceError =
      "Assignees and additional editors must be members of this project.";

    const response = await POST(
      postRequest({ title: "Create task list", assigneeId: userId }),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_TASK_REFERENCE");
    expect(mocks.createTask).not.toHaveBeenCalled();
  });
});
