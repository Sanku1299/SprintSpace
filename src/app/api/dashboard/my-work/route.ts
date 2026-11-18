import { NextResponse } from "next/server";

import { hasCompanyRole } from "@/lib/auth/company-role";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Project } from "@/models/Project";
import { ProjectMember } from "@/models/ProjectMember";
import { Task } from "@/models/Task";

export async function GET(): Promise<Response> {
  try {
    const context = await getWorkspaceContext();
    if (!context)
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
        { status: 401 },
      );
    if (!hasCompanyRole(context, "developer", "designer"))
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Developer or Designer access is required." },
        },
        { status: 403 },
      );
    await connectToDatabase();
    const projectIds = await ProjectMember.find(
      workspaceScopedFilter(context, { userId: context.userId }),
    )
      .distinct("projectId")
      .exec();
    const projectFilter = workspaceScopedFilter(context, { _id: { $in: projectIds } });
    const [projects, tasks, byStatus] = await Promise.all([
      Project.find(projectFilter)
        .select("_id name key status")
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean(),
      Task.find(
        workspaceScopedFilter(context, {
          projectId: { $in: projectIds },
          assigneeId: context.userId,
        }),
      )
        .select("_id projectId title status priority dueDate updatedAt")
        .sort({ dueDate: 1, updatedAt: -1 })
        .limit(100)
        .lean(),
      Task.aggregate([
        {
          $match: workspaceScopedFilter(context, {
            projectId: { $in: projectIds },
            assigneeId: context.userId,
          }),
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const now = new Date();
    return NextResponse.json(
      {
        success: true,
        data: {
          projects: projects.map((project) => ({
            id: project._id.toString(),
            name: project.name,
            key: project.key,
            status: project.status,
          })),
          tasks: tasks.map((task) => ({
            id: task._id.toString(),
            projectId: task.projectId.toString(),
            title: task.title,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate?.toISOString() ?? null,
          })),
          taskCount: tasks.length,
          overdueTasks: tasks.filter(
            (task) => task.dueDate && task.dueDate < now && task.status !== "done",
          ).length,
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
          message: "Your work dashboard is temporarily unavailable.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
