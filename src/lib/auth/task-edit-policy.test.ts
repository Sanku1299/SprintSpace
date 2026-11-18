import { describe, expect, it } from "vitest";

import {
  getEditableTaskFields,
  LIMITED_TASK_EDITABLE_FIELDS,
  TASK_EDITABLE_FIELDS,
} from "./task-edit-policy";

const task = {
  workspaceId: "workspace-a",
  projectId: "project-1",
  assigneeId: "developer-1",
  allowedEditorIds: ["editor-1"],
};
const project = {
  id: "project-1",
  workspaceId: "workspace-a",
  projectManagerId: "pm-1",
};

describe("getEditableTaskFields", () => {
  it("gives an Admin full editable fields only within their workspace", () => {
    expect(
      getEditableTaskFields({
        context: { userId: "admin-1", workspaceId: "workspace-a", role: "admin" },
        task,
        project,
      }),
    ).toEqual(TASK_EDITABLE_FIELDS);
    expect(
      getEditableTaskFields({
        context: { userId: "admin-1", workspaceId: "workspace-b", role: "admin" },
        task,
        project,
      }),
    ).toEqual([]);
  });

  it("gives full editable fields only to the responsible PM", () => {
    expect(
      getEditableTaskFields({
        context: { userId: "pm-1", workspaceId: "workspace-a", role: "project_manager" },
        task,
        project,
      }),
    ).toEqual(TASK_EDITABLE_FIELDS);
    expect(
      getEditableTaskFields({
        context: { userId: "pm-2", workspaceId: "workspace-a", role: "project_manager" },
        task,
        project,
      }),
    ).toEqual([]);
  });

  it("limits assigned Developers and authorized editors who are project members to status", () => {
    expect(
      getEditableTaskFields({
        context: { userId: "developer-1", workspaceId: "workspace-a", role: "developer" },
        task,
        project,
        isProjectMember: true,
      }),
    ).toEqual(LIMITED_TASK_EDITABLE_FIELDS);
    expect(
      getEditableTaskFields({
        context: { userId: "editor-1", workspaceId: "workspace-a", role: "designer" },
        task,
        project,
        isProjectMember: true,
      }),
    ).toEqual(LIMITED_TASK_EDITABLE_FIELDS);
  });

  it("denies nonmembers, unrelated users, and mismatched task/project relationships", () => {
    expect(
      getEditableTaskFields({
        context: { userId: "developer-1", workspaceId: "workspace-a", role: "developer" },
        task,
        project,
      }),
    ).toEqual([]);
    expect(
      getEditableTaskFields({
        context: { userId: "other-user", workspaceId: "workspace-a", role: "developer" },
        task,
        project,
        isProjectMember: true,
      }),
    ).toEqual([]);
    expect(
      getEditableTaskFields({
        context: { userId: "admin-1", workspaceId: "workspace-a", role: "admin" },
        task: { ...task, projectId: "project-2" },
        project,
      }),
    ).toEqual([]);
  });
});
