import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { hasCompanyRole } from "@/lib/auth/company-role";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { DOWNLOAD_URL_TTL_SECONDS, matchesTaskStorageKey } from "@/lib/storage/attachment-upload";
import { getObjectStorageClient } from "@/lib/storage/s3-client";
import { getAccessibleTaskProject } from "@/lib/tasks/task-project-access";
import { Attachment } from "@/models/Attachment";
import { Task } from "@/models/Task";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ attachmentId: string }> };

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function loadAuthorizedAttachment(
  attachmentId: string,
  context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>,
) {
  const attachment = await Attachment.findOne(workspaceScopedFilter(context, { _id: attachmentId }))
    .select(
      "_id workspaceId projectId taskId uploadedBy storageKey originalName mimeType size createdAt",
    )
    .lean();
  if (!attachment) return null;

  const task = await Task.findOne(
    workspaceScopedFilter(context, {
      _id: attachment.taskId,
      projectId: attachment.projectId,
    }),
  )
    .select("_id")
    .lean();
  if (!task) return null;

  const access = await getAccessibleTaskProject(context, attachment.projectId.toString());
  if (!access) return null;
  if (
    !matchesTaskStorageKey(
      attachment.storageKey,
      context.workspaceId,
      access.project._id.toString(),
      task._id.toString(),
    )
  ) {
    return null;
  }

  return { attachment, task, project: access.project };
}

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getWorkspaceContext();
    if (!context) return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");

    const { attachmentId } = await params;
    if (!mongoose.isValidObjectId(attachmentId)) {
      return errorResponse(404, "NOT_FOUND", "Attachment not found.");
    }

    await connectToDatabase();
    const result = await loadAuthorizedAttachment(attachmentId, context);
    if (!result) return errorResponse(404, "NOT_FOUND", "Attachment not found.");

    const { client, config } = getObjectStorageClient();
    const encodedName = encodeURIComponent(result.attachment.originalName).replace(
      /['()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    const downloadUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: result.attachment.storageKey,
        ResponseContentType: result.attachment.mimeType,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodedName}`,
        ResponseCacheControl: "private, no-store",
      }),
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          attachmentId,
          downloadUrl,
          expiresIn: DOWNLOAD_URL_TTL_SECONDS,
          originalName: result.attachment.originalName,
          mimeType: result.attachment.mimeType,
          size: result.attachment.size,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Attachment download is temporarily unavailable.",
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getWorkspaceContext();
    if (!context) return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");

    const { attachmentId } = await params;
    if (!mongoose.isValidObjectId(attachmentId)) {
      return errorResponse(404, "NOT_FOUND", "Attachment not found.");
    }

    await connectToDatabase();
    const result = await loadAuthorizedAttachment(attachmentId, context);
    if (!result) return errorResponse(404, "NOT_FOUND", "Attachment not found.");

    const isUploader = result.attachment.uploadedBy.toString() === context.userId;
    const isAdmin = hasCompanyRole(context, "admin");
    const isResponsibleManager =
      hasCompanyRole(context, "project_manager") &&
      result.project.projectManagerId.toString() === context.userId;
    if (!isUploader && !isAdmin && !isResponsibleManager) {
      return errorResponse(403, "FORBIDDEN", "You cannot delete this attachment.");
    }

    const { client, config } = getObjectStorageClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: result.attachment.storageKey }),
    );
    const deletion = await Attachment.deleteOne(
      workspaceScopedFilter(context, {
        _id: result.attachment._id,
        projectId: result.attachment.projectId,
        taskId: result.task._id,
      }),
    );
    if (deletion.deletedCount !== 1) {
      return errorResponse(404, "NOT_FOUND", "Attachment not found.");
    }

    return NextResponse.json(
      { success: true, data: { deletedAttachmentId: attachmentId } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Attachment deletion is temporarily unavailable.",
    );
  }
}
