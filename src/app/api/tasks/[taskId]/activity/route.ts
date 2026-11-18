import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getAccessibleTaskProject } from "@/lib/tasks/task-project-access";
import { toTaskActivityResponse } from "@/lib/tasks/task-activity-response";
import { TaskActivity } from "@/models/TaskActivity";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

type RouteContext = { params: Promise<{ taskId: string }> };

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getWorkspaceContext();
    if (!context) return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");

    const { taskId } = await params;
    if (!mongoose.isValidObjectId(taskId)) {
      return errorResponse(404, "NOT_FOUND", "Task not found.");
    }

    await connectToDatabase();
    const task = await Task.findOne(workspaceScopedFilter(context, { _id: taskId }))
      .select("_id projectId")
      .lean();
    if (!task) return errorResponse(404, "NOT_FOUND", "Task not found.");

    const access = await getAccessibleTaskProject(context, task.projectId.toString());
    if (!access) return errorResponse(404, "NOT_FOUND", "Task not found.");

    const activityScope = {
      taskId: task._id,
      projectId: access.project._id,
    };
    const before = new URL(request.url).searchParams.get("before");
    let cursorFilter: Record<string, unknown> = {};
    if (before) {
      if (!mongoose.isValidObjectId(before)) {
        return errorResponse(400, "INVALID_CURSOR", "Activity cursor is invalid.");
      }
      const cursor = await TaskActivity.findOne(
        workspaceScopedFilter(context, { _id: before, ...activityScope }),
      )
        .select("_id createdAt")
        .lean();
      if (!cursor) return errorResponse(400, "INVALID_CURSOR", "Activity cursor is invalid.");
      cursorFilter = {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
        ],
      };
    }

    const loadedActivities = await TaskActivity.find(
      workspaceScopedFilter(context, { ...activityScope, ...cursorFilter }),
    )
      .select("_id workspaceId projectId taskId actorId type changes createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .limit(101)
      .lean();
    const hasMore = loadedActivities.length > 100;
    const activities = loadedActivities.slice(0, 100);
    const actorIds = [...new Set(activities.map((activity) => activity.actorId.toString()))];
    const actors = await User.find(workspaceScopedFilter(context, { _id: { $in: actorIds } }))
      .select("_id name avatarUrl")
      .lean();
    const actorsById = new Map(actors.map((actor) => [actor._id.toString(), actor]));

    return NextResponse.json(
      {
        success: true,
        data: {
          activities: activities.map((activity) =>
            toTaskActivityResponse(activity, actorsById.get(activity.actorId.toString())),
          ),
          nextCursor: hasMore ? (activities.at(-1)?._id.toString() ?? null) : null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Task activity is temporarily unavailable.");
  }
}
