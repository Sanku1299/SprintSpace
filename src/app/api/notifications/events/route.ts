import { upgradeWebSocket } from "@vercel/functions";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import { Project } from "@/models/Project";
import { ProjectMember } from "@/models/ProjectMember";
import { hasCompanyRole } from "@/lib/auth/company-role";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const context = await getWorkspaceContext();
  if (!context) return new Response("Unauthorized", { status: 401 });
  await connectToDatabase();

  return upgradeWebSocket(
    (socket) => {
      let closed = false;
      let lastCreatedAt = new Date();
      const poll = async () => {
        if (closed || socket.readyState !== socket.OPEN) return;
        try {
          let projectFilter: Record<string, unknown> = {};
          if (!hasCompanyRole(context, "admin")) {
            const memberProjectIds = await ProjectMember.find(
              workspaceScopedFilter(context, { userId: context.userId }),
            )
              .distinct("projectId")
              .exec();
            const projectIds = [...memberProjectIds];
            if (hasCompanyRole(context, "project_manager")) {
              projectIds.push(
                ...(await Project.find(
                  workspaceScopedFilter(context, { projectManagerId: context.userId }),
                )
                  .distinct("_id")
                  .exec()),
              );
            }
            projectFilter = { projectId: { $in: projectIds } };
          }
          const rows = await Notification.find(
            workspaceScopedFilter(context, {
              recipientId: context.userId,
              createdAt: { $gt: lastCreatedAt },
              ...projectFilter,
            }),
          )
            .select("_id projectId taskId type message readAt createdAt")
            .sort({ createdAt: 1, _id: 1 })
            .limit(100)
            .lean();
          for (const row of rows) {
            socket.send(
              JSON.stringify({
                type: "notification.created",
                notification: {
                  id: row._id.toString(),
                  projectId: row.projectId.toString(),
                  taskId: row.taskId.toString(),
                  type: row.type,
                  message: row.message,
                  readAt: row.readAt,
                  createdAt: row.createdAt,
                },
              }),
            );
            lastCreatedAt = row.createdAt;
          }
        } catch {
          if (socket.readyState === socket.OPEN)
            socket.send(JSON.stringify({ type: "events.retry" }));
        }
      };
      socket.send(JSON.stringify({ type: "events.ready" }));
      const timer = setInterval(() => void poll(), 5000);
      socket.on("close", () => {
        closed = true;
        clearInterval(timer);
      });
      socket.on("error", () => {
        closed = true;
        clearInterval(timer);
      });
    },
    { maxPayload: 1024 },
  );
}
