import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getAccessibleTaskProject } from "@/lib/tasks/task-project-access";
import { toTaskCommentResponse } from "@/lib/tasks/task-comment-response";
import { taskCommentSchema } from "@/lib/validation/task-comment";
import { TaskComment } from "@/models/TaskComment";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

type RouteContext = { params: Promise<{ taskId: string }> };
const COMMENT_FIELDS = "_id workspaceId projectId taskId authorId content createdAt updatedAt";

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function getAccessibleTask(
  taskId: string,
  context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>,
) {
  const task = await Task.findOne(workspaceScopedFilter(context, { _id: taskId }))
    .select("_id workspaceId projectId")
    .lean();
  if (!task) return null;

  const access = await getAccessibleTaskProject(context, task.projectId.toString());
  return access ? { task, access } : null;
}

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getWorkspaceContext();
    if (!context) return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");

    const { taskId } = await params;
    if (!mongoose.isValidObjectId(taskId))
      return errorResponse(404, "NOT_FOUND", "Task not found.");

    await connectToDatabase();
    const result = await getAccessibleTask(taskId, context);
    if (!result) return errorResponse(404, "NOT_FOUND", "Task not found.");

    const comments = await TaskComment.find(
      workspaceScopedFilter(context, { taskId: result.task._id }),
    )
      .select(COMMENT_FIELDS)
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const authors = await User.find(
      workspaceScopedFilter(context, { _id: { $in: comments.map((comment) => comment.authorId) } }),
    )
      .select("_id name avatarUrl")
      .lean();
    const authorsById = new Map(authors.map((author) => [author._id.toString(), author]));

    return NextResponse.json(
      {
        success: true,
        data: {
          comments: comments.map((comment) =>
            toTaskCommentResponse(comment, authorsById.get(comment.authorId.toString())),
          ),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Task comments are temporarily unavailable.");
  }
}

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
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

    const { taskId } = await params;
    if (!mongoose.isValidObjectId(taskId))
      return errorResponse(404, "NOT_FOUND", "Task not found.");

    await connectToDatabase();
    const result = await getAccessibleTask(taskId, context);
    if (!result) return errorResponse(404, "NOT_FOUND", "Task not found.");

    const comment = await TaskComment.create({
      workspaceId: context.workspaceId,
      projectId: result.access.project._id,
      taskId: result.task._id,
      authorId: context.userId,
      content: parsed.data.content,
    });
    const author = await User.findOne(workspaceScopedFilter(context, { _id: context.userId }))
      .select("_id name avatarUrl")
      .lean();

    return NextResponse.json(
      { success: true, data: { comment: toTaskCommentResponse(comment, author ?? undefined) } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Task comments are temporarily unavailable.");
  }
}
