import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { hasCompanyRole } from "@/lib/auth/company-role";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import { Project } from "@/models/Project";
import { ProjectMember } from "@/models/ProjectMember";
import { Task } from "@/models/Task";

function error(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(): Promise<Response> {
  try {
    const context = await getWorkspaceContext();
    if (!context) return error(401, "UNAUTHENTICATED", "Sign in to continue.");
    await connectToDatabase();
    const projectIds = hasCompanyRole(context, "admin")
      ? null
      : await ProjectMember.find(workspaceScopedFilter(context, { userId: context.userId }))
          .distinct("projectId")
          .exec();
    const accessFilter = projectIds
      ? {
          $or: [
            { projectId: { $in: projectIds } },
            ...(hasCompanyRole(context, "project_manager")
              ? [
                  {
                    projectId: {
                      $in: await Project.find(
                        workspaceScopedFilter(context, { projectManagerId: context.userId }),
                      )
                        .distinct("_id")
                        .exec(),
                    },
                  },
                ]
              : []),
          ],
        }
      : {};
    const notifications = await Notification.find(
      workspaceScopedFilter(context, { recipientId: context.userId, ...accessFilter }),
    )
      .select("_id projectId taskId type message readAt createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .lean();
    return NextResponse.json(
      {
        success: true,
        data: {
          notifications: notifications.map((item) => ({
            ...item,
            id: item._id.toString(),
            projectId: item.projectId.toString(),
            taskId: item.taskId.toString(),
          })),
          unreadCount: notifications.filter((item) => !item.readAt).length,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return error(503, "SERVICE_UNAVAILABLE", "Notifications are temporarily unavailable.");
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const context = await getWorkspaceContext();
    if (!context) return error(401, "UNAUTHENTICATED", "Sign in to continue.");
    const body = (await request.json()) as { notificationId?: unknown; markAllRead?: unknown };
    await connectToDatabase();
    const filter = workspaceScopedFilter(context, { recipientId: context.userId, readAt: null });
    if (body.markAllRead === true) {
      await Notification.updateMany(filter, { $set: { readAt: new Date() } });
      return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (typeof body.notificationId !== "string" || !mongoose.isValidObjectId(body.notificationId)) {
      return error(400, "VALIDATION_ERROR", "A valid notification ID is required.");
    }
    const notification = await Notification.findOneAndUpdate(
      { ...filter, _id: body.notificationId },
      { $set: { readAt: new Date() } },
      { new: true },
    )
      .select("_id projectId taskId")
      .lean();
    if (!notification) return error(404, "NOT_FOUND", "Notification not found.");

    const task = await Task.findOne(
      workspaceScopedFilter(context, {
        _id: notification.taskId,
        projectId: notification.projectId,
      }),
    )
      .select("_id")
      .lean();
    const project = await Project.findOne(
      workspaceScopedFilter(context, { _id: notification.projectId }),
    )
      .select("_id")
      .lean();
    return NextResponse.json(
      {
        success: true,
        data: { taskId: task?._id.toString() ?? null, projectId: project?._id.toString() ?? null },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return error(503, "SERVICE_UNAVAILABLE", "Notification could not be updated.");
  }
}
