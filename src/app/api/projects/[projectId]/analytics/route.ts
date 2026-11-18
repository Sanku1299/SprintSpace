import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getAccessibleTaskProject } from "@/lib/tasks/task-project-access";
import { ProjectMember } from "@/models/ProjectMember";
import { Task } from "@/models/Task";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: Context): Promise<Response> {
  try {
    const context = await getWorkspaceContext();
    if (!context)
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
        { status: 401 },
      );
    const { projectId } = await params;
    if (!mongoose.isValidObjectId(projectId))
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Project not found." } },
        { status: 404 },
      );
    await connectToDatabase();
    const access = await getAccessibleTaskProject(context, projectId);
    if (!access)
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Project not found." } },
        { status: 404 },
      );
    const taskScope = workspaceScopedFilter(context, { projectId: access.project._id });
    const [tasksByStatus, overdueTasks, memberCount, totalTasks] = await Promise.all([
      Task.aggregate([
        { $match: taskScope },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Task.countDocuments({ ...taskScope, dueDate: { $lt: new Date() }, status: { $ne: "done" } }),
      ProjectMember.countDocuments(
        workspaceScopedFilter(context, { projectId: access.project._id }),
      ),
      Task.countDocuments(taskScope),
    ]);
    return NextResponse.json(
      {
        success: true,
        data: {
          projectId: access.project._id.toString(),
          memberCount,
          totalTasks,
          overdueTasks,
          tasksByStatus: tasksByStatus.map((row: { _id: string; count: number }) => ({
            status: row._id,
            count: row.count,
          })),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Project analytics are temporarily unavailable.",
        },
      },
      { status: 503 },
    );
  }
}
