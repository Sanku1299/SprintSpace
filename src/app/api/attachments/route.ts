import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { getEditableTaskFields } from "@/lib/auth/task-edit-policy";
import { connectToDatabase } from "@/lib/db/mongoose";
import { toAttachmentResponse } from "@/lib/storage/attachment-response";
import {
  normalizeOriginalFileName,
  registerAttachmentSchema,
} from "@/lib/storage/attachment-upload";
import { getObjectStorageClient } from "@/lib/storage/s3-client";
import { getAccessibleTaskProject } from "@/lib/tasks/task-project-access";
import { Attachment } from "@/models/Attachment";
import { Task } from "@/models/Task";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function matchesTaskStorageKey(
  storageKey: string,
  workspaceId: string,
  projectId: string,
  taskId: string,
): boolean {
  const prefix = `${workspaceId.toLowerCase()}/${projectId.toLowerCase()}/tasks/${taskId.toLowerCase()}/`;
  const suffix = storageKey.startsWith(prefix) ? storageKey.slice(prefix.length) : "";
  return /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(suffix);
}

function canRegisterAttachment(
  context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>,
  task: {
    workspaceId: { toString(): string };
    projectId: { toString(): string };
    assigneeId?: { toString(): string } | null;
    allowedEditorIds?: Array<{ toString(): string }>;
  },
  project: {
    _id: { toString(): string };
    workspaceId: { toString(): string };
    projectManagerId: { toString(): string };
  },
  isProjectMember: boolean,
): boolean {
  return getEditableTaskFields({
    context,
    task,
    project: {
      id: project._id,
      workspaceId: project.workspaceId,
      projectManagerId: project.projectManagerId,
    },
    isProjectMember,
  }).includes("title");
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = registerAttachmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the uploaded file details and try again.",
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
    const task = await Task.findOne(workspaceScopedFilter(context, { _id: parsed.data.taskId }))
      .select("_id workspaceId projectId assigneeId allowedEditorIds")
      .lean();
    if (!task) return errorResponse(404, "NOT_FOUND", "Task not found.");

    const access = await getAccessibleTaskProject(context, task.projectId.toString());
    if (!access) return errorResponse(404, "NOT_FOUND", "Task not found.");
    if (!canRegisterAttachment(context, task, access.project, access.isProjectMember)) {
      return errorResponse(403, "FORBIDDEN", "You cannot upload attachments to this task.");
    }

    if (
      !matchesTaskStorageKey(
        parsed.data.storageKey,
        context.workspaceId,
        access.project._id.toString(),
        task._id.toString(),
      )
    ) {
      return errorResponse(400, "INVALID_STORAGE_KEY", "This upload does not belong to the task.");
    }

    const originalName = normalizeOriginalFileName(parsed.data.originalName);
    if (!originalName) return errorResponse(400, "VALIDATION_ERROR", "Enter a valid file name.");

    const existing = await Attachment.findOne(
      workspaceScopedFilter(context, { storageKey: parsed.data.storageKey }),
    )
      .select("_id workspaceId projectId taskId uploadedBy originalName mimeType size createdAt")
      .lean();
    if (existing) {
      const sameSubmission =
        existing.taskId.toString() === task._id.toString() &&
        existing.uploadedBy.toString() === context.userId &&
        existing.originalName === originalName &&
        existing.mimeType === parsed.data.contentType &&
        existing.size === parsed.data.size;
      return sameSubmission
        ? NextResponse.json(
            { success: true, data: { attachment: toAttachmentResponse(existing) } },
            { headers: { "Cache-Control": "no-store" } },
          )
        : errorResponse(409, "ATTACHMENT_EXISTS", "This storage key is already registered.");
    }

    const { client, config } = getObjectStorageClient();
    const storedObject = await client.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: parsed.data.storageKey }),
    );
    if (
      storedObject.ContentLength !== parsed.data.size ||
      storedObject.ContentType !== parsed.data.contentType
    ) {
      return errorResponse(
        400,
        "UPLOAD_MISMATCH",
        "The uploaded file does not match its declared details.",
      );
    }

    const attachment = await Attachment.create({
      workspaceId: context.workspaceId,
      projectId: access.project._id,
      taskId: task._id,
      uploadedBy: context.userId,
      storageKey: parsed.data.storageKey,
      originalName,
      mimeType: parsed.data.contentType,
      size: storedObject.ContentLength,
    });

    return NextResponse.json(
      { success: true, data: { attachment: toAttachmentResponse(attachment) } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return errorResponse(409, "ATTACHMENT_EXISTS", "This storage key is already registered.");
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error &&
      typeof error.$metadata === "object" &&
      error.$metadata !== null &&
      "httpStatusCode" in error.$metadata &&
      error.$metadata.httpStatusCode === 404
    ) {
      return errorResponse(400, "UPLOAD_NOT_FOUND", "Upload the file before registering it.");
    }
    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Attachment registration is temporarily unavailable.",
    );
  }
}
