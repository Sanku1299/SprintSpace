import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    tasks: Array<Record<string, unknown>>;
    task: Record<string, unknown> | null;
    member: Record<string, unknown> | null;
    bulkError: boolean;
    inTransaction: boolean;
  } = {
    context: null,
    tasks: [],
    task: null,
    member: null,
    bulkError: false,
    inTransaction: false,
  };
  const session = {
    withTransaction: vi.fn(async (callback: () => Promise<void>) => {
      values.inTransaction = true;
      try {
        await callback();
      } finally {
        values.inTransaction = false;
      }
    }),
    endSession: vi.fn(async () => undefined),
  };
  const taskListQuery = {
    select: vi.fn(() => taskListQuery),
    sort: vi.fn(() => taskListQuery),
    session: vi.fn(() => taskListQuery),
    lean: vi.fn(async () => values.tasks),
  };
  const taskQuery = {
    select: vi.fn(() => taskQuery),
    sort: vi.fn(() => taskQuery),
    session: vi.fn(() => taskQuery),
    lean: vi.fn(async () => values.task),
  };
  const membershipQuery = {
    select: vi.fn(() => membershipQuery),
    session: vi.fn(() => membershipQuery),
    lean: vi.fn(async () => values.member),
  };

  return {
    values,
    session,
    taskListQuery,
    taskQuery,
    membershipQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    getAccess: vi.fn(async () => ({
      project: {
        _id: { toString: () => "507f1f77bcf86cd799439002" },
        workspaceId: { toString: () => "507f1f77bcf86cd799439001" },
        projectManagerId: { toString: () => "507f1f77bcf86cd799439003" },
      },
      isProjectMember: true,
    })),
    updateProject: vi.fn(async () => ({ matchedCount: 1 })),
    findTasks: vi.fn(() => taskListQuery),
    findTask: vi.fn(() => ({
      select: vi.fn(() => ({
        sort: vi.fn(() => ({
          session: vi.fn(() => ({
            lean: vi.fn(async () => values.task),
          })),
        })),
        session: vi.fn(() => ({
          lean: vi.fn(async () => values.task),
        })),
      })),
      sort: vi.fn(() => taskQuery),
      session: vi.fn(() => taskQuery),
      lean: vi.fn(async () => values.task),
    })),
    updateTask: vi.fn(
      async (
        filter: Record<string, unknown>,
        update: Record<string, unknown>,
        options: Record<string, unknown>,
      ) => {
        void filter;
        void update;
        void options;
        return { matchedCount: 1 };
      },
    ),
    bulkWrite: vi.fn(async (operations: unknown[]) => {
      if (!values.inTransaction) throw new Error("bulkWrite was outside a transaction");
      if (values.bulkError) throw new Error("simulated write failure");
      return { matchedCount: operations.length };
    }),
    findMember: vi.fn(() => membershipQuery),
    startSession: vi.fn(async () => session),
  };
});

vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: () => true,
    startSession: mocks.startSession,
  },
}));
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
vi.mock("@/models/Project", () => ({ Project: { updateOne: mocks.updateProject } }));
vi.mock("@/models/ProjectMember", () => ({ ProjectMember: { findOne: mocks.findMember } }));
vi.mock("@/models/Task", () => ({
  Task: {
    find: mocks.findTasks,
    findOne: mocks.findTask,
    updateOne: mocks.updateTask,
    bulkWrite: mocks.bulkWrite,
  },
}));

import { PATCH } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const projectId = "507f1f77bcf86cd799439002";
const managerId = "507f1f77bcf86cd799439003";
const developerId = "507f1f77bcf86cd799439004";
const firstId = "507f1f77bcf86cd799439005";
const secondId = "507f1f77bcf86cd799439006";
const thirdId = "507f1f77bcf86cd799439007";

function id(value: string) {
  return { toString: () => value };
}

function task(taskId: string, status: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id(taskId),
    workspaceId: id(workspaceId),
    projectId: id(projectId),
    title: `Task ${taskId}`,
    description: "",
    status,
    priority: "medium",
    assigneeId: null,
    allowedEditorIds: [],
    dueDate: null,
    labels: [],
    parentTaskId: null,
    position: 0,
    createdBy: id(managerId),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function request(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/projects/${projectId}/board`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const routeContext = { params: Promise.resolve({ projectId }) };

describe("/api/projects/[projectId]/board", () => {
  beforeEach(() => {
    mocks.values.context = { userId: managerId, workspaceId, role: "admin" };
    mocks.values.tasks = [
      task(firstId, "todo"),
      task(secondId, "todo"),
      task(thirdId, "in_progress"),
    ];
    mocks.values.task = task(firstId, "todo", { assigneeId: id(developerId) });
    mocks.values.member = { _id: id("membership") };
    mocks.values.bulkError = false;
    mocks.values.inTransaction = false;
    mocks.bulkWrite.mockClear();
    mocks.updateTask.mockClear();
    mocks.updateProject.mockClear();
    mocks.findMember.mockClear();
    mocks.session.withTransaction.mockClear();
    mocks.session.endSession.mockClear();
  });

  it("persists a full lane reorder in one transaction batch", async () => {
    const response = await PATCH(
      request({
        mode: "reorder",
        taskId: firstId,
        fromStatus: "todo",
        toStatus: "todo",
        lanes: {
          todo: [secondId, firstId],
          in_progress: [thirdId],
          in_review: [],
          done: [],
        },
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(mocks.session.withTransaction).toHaveBeenCalledOnce();
    expect(mocks.bulkWrite).toHaveBeenCalledOnce();
    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it("rejects stale or incomplete lane lists without writing any tasks", async () => {
    const response = await PATCH(
      request({
        mode: "reorder",
        taskId: firstId,
        fromStatus: "todo",
        toStatus: "todo",
        lanes: {
          todo: [firstId],
          in_progress: [thirdId],
          in_review: [],
          done: [],
        },
      }),
      routeContext,
    );

    expect(response.status).toBe(409);
    expect(mocks.bulkWrite).not.toHaveBeenCalled();
  });

  it("persists a limited editor's status transition without accepting client ordering", async () => {
    mocks.values.context = { userId: developerId, workspaceId, role: "developer" };
    mocks.values.task = task(firstId, "todo", { assigneeId: id(developerId) });

    const response = await PATCH(
      request({ mode: "status", taskId: firstId, fromStatus: "todo", toStatus: "in_progress" }),
      routeContext,
    );

    expect(response.status).toBe(200);
    const [filter] = mocks.updateTask.mock.calls[0] ?? [];
    expect((filter as { _id: { toString(): string } })._id.toString()).toBe(firstId);
    expect(mocks.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId }),
      { $set: { status: "in_progress" } },
      expect.objectContaining({ session: mocks.session }),
    );
    expect(mocks.bulkWrite).not.toHaveBeenCalled();
  });

  it("surfaces a transactional batch failure without reporting success", async () => {
    mocks.values.bulkError = true;

    const response = await PATCH(
      request({
        mode: "reorder",
        taskId: firstId,
        fromStatus: "todo",
        toStatus: "todo",
        lanes: {
          todo: [secondId, firstId],
          in_progress: [thirdId],
          in_review: [],
          done: [],
        },
      }),
      routeContext,
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(mocks.bulkWrite).toHaveBeenCalledOnce();
    expect(mocks.session.withTransaction).toHaveBeenCalledOnce();
  });
});
