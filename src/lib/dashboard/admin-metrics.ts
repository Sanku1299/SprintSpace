import "server-only";

import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

export type AdminDashboardMetrics = {
  members: { total: number; active: number };
  projects: { total: number; active: number; byStatus: Array<{ status: string; count: number }> };
  tasks: { total: number; byStatus: Array<{ status: string; count: number }> };
};

type AggregateCount = { _id: string; count: number };

export async function getAdminDashboardMetrics(
  workspaceId: string,
): Promise<AdminDashboardMetrics> {
  await connectToDatabase();
  const scope = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
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
    Task.aggregate<AggregateCount>([
      { $match: scope },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Project.aggregate<AggregateCount>([
      { $match: scope },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    members: { total: members, active: activeMembers },
    projects: {
      total: projects,
      active: activeProjects,
      byStatus: projectsByStatus.map((row) => ({ status: row._id, count: row.count })),
    },
    tasks: {
      total: taskCount,
      byStatus: tasksByStatus.map((row) => ({ status: row._id, count: row.count })),
    },
  };
}
