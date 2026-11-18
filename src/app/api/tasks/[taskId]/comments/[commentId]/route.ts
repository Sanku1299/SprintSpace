import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { hasCompanyRole } from "@/lib/auth/company-role";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getAccessibleTaskProject } from "@/lib/tasks/task-project-access";
import { toTaskCommentResponse } from "@/lib/tasks/task-comment-response";
import { taskCommentSchema } from "@/lib/validation/task-comment";
import { TaskComment } from "@/models/TaskComment";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

type RouteContext = { params: Promise<{ taskId: string; commentId: string }> };
const COMMENT_FIELDS = "_id workspaceId projectId taskId authorId content createdAt updatedAt";

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function canManageComment(
  context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>,
  project: { projectManagerId: { toString(): string } },
  authorId: { toString(): string },
): boolean {
  return (
    authorId.toString() === context.userId ||
    hasCompanyRole(context, "admin") ||
    (hasCompanyRole(context, "project_manager") &&
      project.projectManagerId.toString() === context.userId)
  );
}

async function loadTaskAndProject(
  taskId: string,
  context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>,
) {
  const task = await Task.findOne(workspaceScopedFilter(context, { _id: taskId }))
    .select("_id projectId")
    .lean();
  if (!task) return null;

  const access = await getAccessibleTaskProject(context, task.projectId.toString());
  return access ? { task, project: access.project } : null;
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = taskCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Enter a comment with 1 to 5000 characters.",
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const context = await getWorkspaceContext();
    if (!context) return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");

    const { taskId, commentId } = await params;
    if (!mongoose.isValidObjectId(taskId) || !mongoose.isValidObjectId(commentId)) {
      return errorResponse(404, "NOT_FOUND", "Comment not found.");
    }

    await connectToDatabase();
    const result = await loadTaskAndProject(taskId, context);
    if (!result) return errorResponse(404, "NOT_FOUND", "Comment not found.");

    const filter = workspaceScopedFilter(context, {
      _id: commentId,
      taskId: result.task._id,
    });
    const existing = await TaskComment.findOne(filter).select("_id authorId").lean();
    if (!existing) return errorResponse(404, "NOT_FOUND", "Comment not found.");
    if (!canManageComment(context, result.project, existing.authorId)) {
      return errorResponse(403, "FORBIDDEN", "You cannot edit this comment.");
    }

    const comment = await TaskComment.findOneAndUpdate(
      filter,
      { $set: { content: parsed.data.content } },
      { new: true, runValidators: true },
    )
      .select(COMMENT_FIELDS)
      .lean();
    if (!comment) return errorResponse(404, "NOT_FOUND", "Comment not found.");

    const author = await User.findOne(workspaceScopedFilter(context, { _id: comment.authorId }))
      .select("_id name avatarUrl")
      .lean();

    return NextResponse.json(
      { success: true, data: { comment: toTaskCommentResponse(comment, author ?? undefined) } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Task comments are temporarily unavailable.");
  }
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getWorkspaceContext();
    if (!context) return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");

    const { taskId, commentId } = await params;
    if (!mongoose.isValidObjectId(taskId) || !mongoose.isValidObjectId(commentId)) {
      return errorResponse(404, "NOT_FOUND", "Comment not found.");
    }

    await connectToDatabase();
    const result = await loadTaskAndProject(taskId, context);
    if (!result) return errorResponse(404, "NOT_FOUND", "Comment not found.");

    const filter = workspaceScopedFilter(context, {
      _id: commentId,
      taskId: result.task._id,
    });
    const comment = await TaskComment.findOne(filter).select("_id authorId").lean();
    if (!comment) return errorResponse(404, "NOT_FOUND", "Comment not found.");
    if (!canManageComment(context, result.project, comment.authorId)) {
      return errorResponse(403, "FORBIDDEN", "You cannot delete this comment.");
    }

    const deletion = await TaskComment.deleteOne(filter);
    if (deletion.deletedCount !== 1) return errorResponse(404, "NOT_FOUND", "Comment not found.");

    return NextResponse.json(
      { success: true, data: { deletedCommentId: commentId } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Task comments are temporarily unavailable.");
  }
}
