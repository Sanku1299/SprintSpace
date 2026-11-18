import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { hasCompanyRole } from "@/lib/auth/company-role";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TASK_API_FIELDS, toTaskResponse } from "@/lib/tasks/task-api-response";
import { getAccessibleTaskProject } from "@/lib/tasks/task-project-access";
import { validateTaskReferences } from "@/lib/tasks/validate-task-references";
import { createTaskSchema } from "@/lib/validation/task";
import { Task } from "@/models/Task";

type RouteContext = { params: Promise<{ projectId: string }> };

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
      .select(TASK_API_FIELDS)
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
