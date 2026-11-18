import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { getEditableTaskFields } from "@/lib/auth/task-edit-policy";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  normalizeOriginalFileName,
  UPLOAD_URL_TTL_SECONDS,
  createPresignedUploadSchema,
} from "@/lib/storage/attachment-upload";
import { getObjectStorageClient } from "@/lib/storage/s3-client";
import { getAccessibleTaskProject } from "@/lib/tasks/task-project-access";
import { Task } from "@/models/Task";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = createPresignedUploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Choose a supported file up to 25 MB.",
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const context = await getWorkspaceContext();
    if (!context) return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");

    await connectToDatabase();
    const task = await Task.findOne(
      workspaceScopedFilter(context, { _id: parsed.data.taskId.toLowerCase() }),
    )
      .select("_id workspaceId projectId assigneeId allowedEditorIds")
      .lean();
    if (!task) return errorResponse(404, "NOT_FOUND", "Task not found.");

    const access = await getAccessibleTaskProject(context, task.projectId.toString());
    if (!access) return errorResponse(404, "NOT_FOUND", "Task not found.");

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
    if (!editableFields.includes("title")) {
      return errorResponse(403, "FORBIDDEN", "You cannot upload attachments to this task.");
    }

    const originalName = normalizeOriginalFileName(parsed.data.fileName);
    if (!originalName) {
      return errorResponse(400, "VALIDATION_ERROR", "Enter a valid file name.");
    }

    const { client, config } = getObjectStorageClient();
    const storageKey = [
      context.workspaceId,
      access.project._id.toString(),
      "tasks",
      task._id.toString(),
      randomUUID(),
    ].join("/");
    const presignedPost = await createPresignedPost(client, {
      Bucket: config.bucket,
      Key: storageKey,
      Expires: UPLOAD_URL_TTL_SECONDS,
      Fields: { "Content-Type": parsed.data.contentType },
      Conditions: [
        ["eq", "$Content-Type", parsed.data.contentType],
        ["content-length-range", parsed.data.size, parsed.data.size],
      ],
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          uploadUrl: presignedPost.url,
          fields: presignedPost.fields,
          storageKey,
          originalName,
          contentType: parsed.data.contentType,
          size: parsed.data.size,
          expiresIn: UPLOAD_URL_TTL_SECONDS,
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "File upload is temporarily unavailable.");
  }
}
