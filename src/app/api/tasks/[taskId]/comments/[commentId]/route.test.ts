import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values: {
    context: { userId: string; workspaceId: string; role: string } | null;
    task: Record<string, unknown>;
    project: Record<string, unknown>;
    comment: Record<string, unknown>;
    updatedComment: Record<string, unknown>;
    profiles: Array<Record<string, unknown>>;
  } = {
    context: null,
    task: {},
    project: {},
    comment: {},
    updatedComment: {},
    profiles: [],
  };

  const taskQuery = {
    select: vi.fn(() => taskQuery),
    lean: vi.fn(async () => values.task),
  };
  const commentQuery = {
    select: vi.fn(() => commentQuery),
    lean: vi.fn(async () => values.comment),
  };
  const updatedCommentQuery = {
    select: vi.fn(() => updatedCommentQuery),
    lean: vi.fn(async () => values.updatedComment),
  };
  const profileQuery = {
    select: vi.fn(() => profileQuery),
    lean: vi.fn(async () => values.profiles),
  };

  return {
    values,
    taskQuery,
    commentQuery,
    updatedCommentQuery,
    profileQuery,
    getContext: vi.fn(async () => values.context),
    connect: vi.fn(async () => undefined),
    getAccess: vi.fn(async () => ({ project: values.project, isProjectMember: false })),
    findTask: vi.fn(() => taskQuery),
    findComment: vi.fn(() => commentQuery),
    updateComment: vi.fn(() => updatedCommentQuery),
    findProfiles: vi.fn(() => profileQuery),
    validateMentions: vi.fn(async () => null),
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
vi.mock("@/lib/tasks/validate-comment-mentions", () => ({
  validateCommentMentions: mocks.validateMentions,
}));
vi.mock("@/models/Task", () => ({ Task: { findOne: mocks.findTask } }));
vi.mock("@/models/TaskComment", () => ({
  TaskComment: {
    findOne: mocks.findComment,
    findOneAndUpdate: mocks.updateComment,
  },
}));
vi.mock("@/models/User", () => ({ User: { find: mocks.findProfiles } }));

import { PATCH } from "./route";

const workspaceId = "507f1f77bcf86cd799439001";
const projectId = "507f1f77bcf86cd799439002";
const taskId = "507f1f77bcf86cd799439003";
const commentId = "507f1f77bcf86cd799439004";
const authorId = "507f1f77bcf86cd799439005";
const managerId = "507f1f77bcf86cd799439006";
const editorId = "507f1f77bcf86cd799439007";

function id(value: string) {
  return { toString: () => value };
}

function patchRequest() {
  return new Request(`http://localhost/api/tasks/${taskId}/comments/${commentId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: "Updated comment" }),
  });
}

function routeContext() {
  return { params: Promise.resolve({ taskId, commentId }) };
}

describe("PATCH /api/tasks/[taskId]/comments/[commentId]", () => {
  beforeEach(() => {
    mocks.values.context = { userId: authorId, workspaceId, role: "developer" };
    mocks.values.task = { _id: id(taskId), projectId: id(projectId) };
    mocks.values.project = {
      _id: id(projectId),
      workspaceId: id(workspaceId),
      projectManagerId: id(managerId),
    };
    mocks.values.comment = { _id: id(commentId), authorId: id(authorId), mentionIds: [] };
    mocks.values.updatedComment = {
      _id: id(commentId),
      workspaceId: id(workspaceId),
      projectId: id(projectId),
      taskId: id(taskId),
      authorId: id(authorId),
      mentionIds: [],
      content: "Updated comment",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    mocks.values.profiles = [{ _id: id(authorId), name: "Comment author", avatarUrl: null }];
    vi.clearAllMocks();
  });

  it.each([
    ["the author", authorId, "developer", true],
    ["an Admin", editorId, "admin", true],
    ["the responsible PM", managerId, "project_manager", true],
    ["another project member", editorId, "developer", false],
    ["an unrelated PM", editorId, "project_manager", false],
  ])("enforces comment edit access for %s", async (_description, userId, role, allowed) => {
    mocks.values.context = { userId, workspaceId, role };

    const response = await PATCH(patchRequest(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(allowed ? 200 : 403);
    if (allowed) {
      expect(body.data.comment.content).toBe("Updated comment");
      expect(mocks.updateComment).toHaveBeenCalled();
    } else {
      expect(body.error.code).toBe("FORBIDDEN");
      expect(mocks.updateComment).not.toHaveBeenCalled();
    }
  });

  it("scopes task, comment, and profile lookups to the active workspace", async () => {
    const response = await PATCH(patchRequest(), routeContext());

    expect(response.status).toBe(200);
    expect(mocks.findTask).toHaveBeenCalledWith({ _id: taskId, workspaceId });
    expect(mocks.findComment).toHaveBeenCalledWith({
      _id: commentId,
      taskId: id(taskId),
      workspaceId,
    });
    expect(mocks.findProfiles).toHaveBeenCalledWith({
      _id: { $in: [authorId] },
      workspaceId,
    });
  });
});
