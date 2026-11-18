import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { hasCompanyRole } from "@/lib/auth/company-role";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getAccessibleTaskProject } from "@/lib/tasks/task-project-access";
import { validateTaskReferences } from "@/lib/tasks/validate-task-references";
import { createTaskSchema } from "@/lib/validation/task";
import { Task } from "@/models/Task";

type RouteContext = { params: Promise<{ projectId: string }> };

const TASK_FIELDS =
  "_id workspaceId projectId title description status priority assigneeId allowedEditorIds dueDate labels parentTaskId position createdBy createdAt updatedAt";

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
        message: "Review the task details and try again.",
        fields: issues,
      },
    },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

function toTaskResponse(task: {
  _id: { toString(): string };
  workspaceId: { toString(): string };
  projectId: { toString(): string };
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeId?: { toString(): string } | null;
  allowedEditorIds: Array<{ toString(): string }>;
  dueDate?: Date | null;
  labels: string[];
  parentTaskId?: { toString(): string } | null;
  position: number;
  createdBy: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: task._id.toString(),
    workspaceId: task.workspaceId.toString(),
    projectId: task.projectId.toString(),
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId?.toString() ?? null,
    allowedEditorIds: task.allowedEditorIds.map((id) => id.toString()),
    dueDate: task.dueDate?.toISOString() ?? null,
    labels: task.labels,
    parentTaskId: task.parentTaskId?.toString() ?? null,
    position: task.position,
    createdBy: task.createdBy.toString(),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getWorkspaceContext();

    if (!context) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    const { projectId } = await params;

    if (!mongoose.isValidObjectId(projectId)) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    await connectToDatabase();
    const access = await getAccessibleTaskProject(context, projectId);

    if (!access) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    const tasks = await Task.find(workspaceScopedFilter(context, { projectId: access.project._id }))
      .select(TASK_FIELDS)
      .sort({ position: 1, createdAt: 1, _id: 1 })
      .lean();

    return NextResponse.json(
      { success: true, data: { tasks: tasks.map(toTaskResponse) } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Project tasks are temporarily unavailable.");
  }
}

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = createTaskSchema.safeParse(body);

  if (!parsed.success) {
    return validationResponse(parsed.error.flatten().fieldErrors);
  }

  try {
    const context = await getWorkspaceContext();

    if (!context) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    if (!hasCompanyRole(context, "admin", "project_manager")) {
      return errorResponse(403, "FORBIDDEN", "You cannot create tasks.");
    }

    const { projectId } = await params;

    if (!mongoose.isValidObjectId(projectId)) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    await connectToDatabase();
    const access = await getAccessibleTaskProject(context, projectId);

    if (!access) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    const referenceError = await validateTaskReferences({
      context,
      projectId: access.project._id.toString(),
      assigneeId: parsed.data.assigneeId,
      allowedEditorIds: parsed.data.allowedEditorIds,
      parentTaskId: parsed.data.parentTaskId,
    });

    if (referenceError) {
      return errorResponse(400, "INVALID_TASK_REFERENCE", referenceError);
    }

    const task = await Task.create({
      ...parsed.data,
      workspaceId: context.workspaceId,
      projectId: access.project._id,
      createdBy: context.userId,
    });

    return NextResponse.json(
      { success: true, data: { task: toTaskResponse(task) } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Project tasks are temporarily unavailable.");
  }
}
