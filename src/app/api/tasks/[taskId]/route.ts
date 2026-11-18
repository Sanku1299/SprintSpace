import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { getEditableTaskFields } from "@/lib/auth/task-edit-policy";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TASK_API_FIELDS, toTaskResponse } from "@/lib/tasks/task-api-response";
import { recordTaskActivity, taskActivityChanges } from "@/lib/tasks/task-activity";
import { getAccessibleTaskProject } from "@/lib/tasks/task-project-access";
import { validateTaskReferences } from "@/lib/tasks/validate-task-references";
import { updateTaskSchema } from "@/lib/validation/task";
import { Task } from "@/models/Task";

type RouteContext = { params: Promise<{ taskId: string }> };

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function validationResponse(issues: Record<string, string[] | undefined>): Response {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Review the task fields and try again.",
        fields: issues,
      },
    },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getWorkspaceContext();

    if (!context) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    const { taskId } = await params;

    if (!mongoose.isValidObjectId(taskId)) {
      return errorResponse(404, "NOT_FOUND", "Task not found.");
    }

    await connectToDatabase();
    const task = await Task.findOne(workspaceScopedFilter(context, { _id: taskId }))
      .select(TASK_API_FIELDS)
      .lean();

    if (!task) {
      return errorResponse(404, "NOT_FOUND", "Task not found.");
    }

    const access = await getAccessibleTaskProject(context, task.projectId.toString());

    if (!access) {
      return errorResponse(404, "NOT_FOUND", "Task not found.");
    }

    return NextResponse.json(
      { success: true, data: { task: toTaskResponse(task) } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Task service is temporarily unavailable.");
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = updateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return validationResponse(parsed.error.flatten().fieldErrors);
  }

  try {
    const context = await getWorkspaceContext();

    if (!context) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    const { taskId } = await params;

    if (!mongoose.isValidObjectId(taskId)) {
      return errorResponse(404, "NOT_FOUND", "Task not found.");
    }

    await connectToDatabase();
    const task = await Task.findOne(workspaceScopedFilter(context, { _id: taskId })).select(
      "_id workspaceId projectId title description status priority assigneeId allowedEditorIds dueDate labels parentTaskId position",
    );

    if (!task) {
      return errorResponse(404, "NOT_FOUND", "Task not found.");
    }

    const access = await getAccessibleTaskProject(context, task.projectId.toString());

    if (!access) {
      return errorResponse(404, "NOT_FOUND", "Task not found.");
    }

    const editableFields = getEditableTaskFields({
      context,
      task,
      project: {
        id: access.project._id,
        workspaceId: access.project.workspaceId,
        projectManagerId: access.project.projectManagerId,
      },
      isProjectMember: access.isProjectMember,
    });
    const requestedFields = Object.keys(parsed.data);

    if (
      requestedFields.some(
        (field) => !editableFields.includes(field as (typeof editableFields)[number]),
      )
    ) {
      return errorResponse(403, "FORBIDDEN", "You cannot update one or more of these task fields.");
    }

    const hasReferenceUpdates =
      parsed.data.assigneeId !== undefined ||
      parsed.data.allowedEditorIds !== undefined ||
      parsed.data.parentTaskId !== undefined;

    if (hasReferenceUpdates) {
      const referenceError = await validateTaskReferences({
        context,
        projectId: access.project._id.toString(),
        taskId,
        assigneeId: parsed.data.assigneeId,
        allowedEditorIds: parsed.data.allowedEditorIds,
        parentTaskId: parsed.data.parentTaskId,
      });

      if (referenceError) {
        return errorResponse(400, "INVALID_TASK_REFERENCE", referenceError);
      }
    }

    const updatedTask = await Task.findOneAndUpdate(
      workspaceScopedFilter(context, { _id: taskId, projectId: access.project._id }),
      { $set: parsed.data },
      { new: true, runValidators: true },
    ).select(TASK_API_FIELDS);

    if (!updatedTask) {
      return errorResponse(404, "NOT_FOUND", "Task not found.");
    }

    const currentTask = task as unknown as Record<string, unknown>;
    const previousValues = Object.fromEntries(
      Object.keys(parsed.data).map((field) => [field, currentTask[field]]),
    );
    const changes = taskActivityChanges(previousValues, parsed.data as Record<string, unknown>);
    if (changes.length > 0) {
      await recordTaskActivity({
        context,
        projectId: access.project._id,
        taskId: task._id,
        type:
          changes.length === 1 && changes[0]?.field === "status"
            ? "task_status_changed"
            : "task_updated",
        changes,
      });
    }

    return NextResponse.json(
      { success: true, data: { task: toTaskResponse(updatedTask) } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Task service is temporarily unavailable.");
  }
}
