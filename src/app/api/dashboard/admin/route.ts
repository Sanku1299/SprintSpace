import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasCompanyRole } from "@/lib/auth/company-role";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

export async function GET(): Promise<Response> {
  try {
    const context = await getWorkspaceContext();
    if (!context)
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
        { status: 401 },
      );
    if (!hasCompanyRole(context, "admin"))
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Admin access is required." } },
        { status: 403 },
      );
    await connectToDatabase();
    const scope = workspaceScopedFilter(context, {});
    const [
      members,
      activeMembers,
      projects,
      activeProjects,
      taskCount,
      tasksByStatus,
      projectsByStatus,
    ] = await Promise.all([
      User.countDocuments(scope),
      User.countDocuments({ ...scope, status: "active" }),
      Project.countDocuments(scope),
      Project.countDocuments({ ...scope, status: "active" }),
      Task.countDocuments(scope),
      Task.aggregate([
        { $match: scope },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Project.aggregate([
        { $match: scope },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    return NextResponse.json(
      {
        success: true,
        data: {
          members: { total: members, active: activeMembers },
          projects: {
            total: projects,
            active: activeProjects,
            byStatus: projectsByStatus.map((row: { _id: string; count: number }) => ({
              status: row._id,
              count: row.count,
            })),
          },
          tasks: {
            total: taskCount,
            byStatus: tasksByStatus.map((row: { _id: string; count: number }) => ({
              status: row._id,
              count: row.count,
            })),
          },
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
