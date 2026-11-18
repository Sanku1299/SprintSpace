import { NextResponse } from "next/server";

import { hasCompanyRole } from "@/lib/auth/company-role";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";

export async function GET(): Promise<Response> {
  try {
    const context = await getWorkspaceContext();
    if (!context)
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
        { status: 401 },
      );
    if (!hasCompanyRole(context, "project_manager"))
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Project Manager access is required." },
        },
        { status: 403 },
      );
    await connectToDatabase();
    const projects = await Project.find(
      workspaceScopedFilter(context, { projectManagerId: context.userId }),
    )
      .select("_id name key status priority endDate")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    const projectIds = projects.map((project) => project._id);
    const taskScope = workspaceScopedFilter(context, { projectId: { $in: projectIds } });
    const [taskCount, byStatus, overdue] = await Promise.all([
      Task.countDocuments(taskScope),
      Task.aggregate([
        { $match: taskScope },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Task.countDocuments({ ...taskScope, dueDate: { $lt: new Date() }, status: { $ne: "done" } }),
    ]);
    return NextResponse.json(
      {
        success: true,
        data: {
          projects: projects.map((project) => ({
            id: project._id.toString(),
            name: project.name,
            key: project.key,
            status: project.status,
            priority: project.priority,
            endDate: project.endDate,
          })),
          projectCount: projects.length,
          taskCount,
          overdueTasks: overdue,
          tasksByStatus: byStatus.map((row: { _id: string; count: number }) => ({
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
          message: "Dashboard metrics are temporarily unavailable.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
