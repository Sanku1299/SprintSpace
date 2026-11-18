import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getEditableTaskFields } from "@/lib/auth/task-edit-policy";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TASK_API_FIELDS, toTaskResponse } from "@/lib/tasks/task-api-response";
import { recordTaskActivity } from "@/lib/tasks/task-activity";
import { getAccessibleTaskProject } from "@/lib/tasks/task-project-access";
import { TASK_STATUSES } from "@/lib/tasks/task-constants";
import { Project } from "@/models/Project";
import { ProjectMember } from "@/models/ProjectMember";
import { Task } from "@/models/Task";

type RouteContext = { params: Promise<{ projectId: string }> };
type BoardStatus = (typeof TASK_STATUSES)[number];

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i)
  .transform((value) => value.toLowerCase());
const statusSchema = z.enum(TASK_STATUSES);
const lanesSchema = z
  .object({
    todo: z.array(objectIdSchema),
    in_progress: z.array(objectIdSchema),
    in_review: z.array(objectIdSchema),
    done: z.array(objectIdSchema),
  })
  .strict();

const boardMoveSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("reorder"),
      taskId: objectIdSchema,
      fromStatus: statusSchema,
      toStatus: statusSchema,
      lanes: lanesSchema,
    })
    .strict(),
  z
    .object({
      mode: z.literal("status"),
      taskId: objectIdSchema,
      fromStatus: statusSchema,
      toStatus: statusSchema,
    })
    .strict(),
]);

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

class BoardMoveError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = boardMoveSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Review the board move and try again.");
  }

  try {
    const context = await getWorkspaceContext();
    if (!context) return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");

    const { projectId } = await params;
    if (!mongoose.isValidObjectId(projectId)) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    await connectToDatabase();
    const access = await getAccessibleTaskProject(context, projectId);
    if (!access) return errorResponse(404, "NOT_FOUND", "Project not found.");

    const session = await mongoose.startSession();
    let responseTasks: Awaited<ReturnType<typeof loadProjectTasks>> = [];

    try {
      await session.withTransaction(async () => {
        const projectFilter = workspaceScopedFilter(context, {
          _id: access.project._id,
          projectManagerId: access.project.projectManagerId,
        });
        const projectLock = await Project.updateOne(
          projectFilter,
          { $inc: { boardRevision: 1 } },
          { session, timestamps: false },
        );

        if (projectLock.matchedCount !== 1) {
          throw new BoardMoveError(404, "NOT_FOUND", "Project not found.");
        }

        const input = parsed.data;
        if (input.mode === "status") {
          if (input.fromStatus === input.toStatus) {
            throw new BoardMoveError(400, "NO_OP", "Choose a different status for this task.");
          }

          const task = await Task.findOne(
            workspaceScopedFilter(context, { _id: input.taskId, projectId: access.project._id }),
          )
            .select("_id workspaceId projectId status assigneeId allowedEditorIds")
            .session(session)
            .lean();

          if (!task) throw new BoardMoveError(404, "NOT_FOUND", "Task not found.");
          if (task.status !== input.fromStatus) {
            throw new BoardMoveError(
              409,
              "STALE_BOARD",
              "This task changed. Refresh the board and try again.",
            );
          }

          const isProjectMember =
            context.role === "developer" || context.role === "designer"
              ? Boolean(
                  await ProjectMember.findOne(
                    workspaceScopedFilter(context, {
                      projectId: access.project._id,
                      userId: context.userId,
                    }),
                  )
                    .select("_id")
                    .session(session)
                    .lean(),
                )
              : false;
          const editableFields = getEditableTaskFields({
            context,
            task,
            project: {
              id: access.project._id,
              workspaceId: access.project.workspaceId,
              projectManagerId: access.project.projectManagerId,
            },
            isProjectMember,
          });

          if (!editableFields.includes("status")) {
            throw new BoardMoveError(403, "FORBIDDEN", "You cannot change this task's status.");
          }

          const update = await Task.updateOne(
            workspaceScopedFilter(context, { _id: task._id, projectId: access.project._id }),
            { $set: { status: input.toStatus } },
            { session },
          );

          if (update.matchedCount !== 1) {
            throw new BoardMoveError(
              409,
              "STALE_BOARD",
              "This task changed. Refresh the board and try again.",
            );
          }
          await recordTaskActivity({
            context,
            projectId: access.project._id,
            taskId: task._id,
            type: "task_status_changed",
            changes: [{ field: "status", from: task.status, to: input.toStatus }],
            session,
          });
        } else {
          await persistReorder({
            context,
            project: access.project,
            isProjectMember: access.isProjectMember,
            move: input,
            session,
          });
        }

        responseTasks = await loadProjectTasks(context, access.project._id, session);
      });

      return NextResponse.json(
        { success: true, data: { tasks: responseTasks.map(toTaskResponse) } },
        { headers: { "Cache-Control": "no-store" } },
      );
    } finally {
      await session.endSession();
    }
  } catch (error) {
    if (error instanceof BoardMoveError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Board move could not be saved. Try again.");
  }
}

async function persistReorder({
  context,
  project,
  isProjectMember,
  move,
  session,
}: {
  context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>;
  project: {
    _id: { toString(): string };
    workspaceId: { toString(): string };
    projectManagerId: { toString(): string };
  };
  isProjectMember: boolean;
  move: Extract<z.infer<typeof boardMoveSchema>, { mode: "reorder" }>;
  session: mongoose.ClientSession;
}) {
  const tasks = await loadProjectTasks(context, project._id, session);
  const taskById = new Map(tasks.map((task) => [task._id.toString(), task]));
  const requestedLaneById = new Map<string, BoardStatus>();

  for (const status of TASK_STATUSES) {
    for (const taskId of move.lanes[status]) {
      if (requestedLaneById.has(taskId)) {
        throw new BoardMoveError(400, "INVALID_ORDER", "Each task must appear once on the board.");
      }
      requestedLaneById.set(taskId, status);
    }
  }

  const movedTask = taskById.get(move.taskId);
  if (!movedTask) throw new BoardMoveError(404, "NOT_FOUND", "Task not found.");
  if (movedTask.status !== move.fromStatus) {
    throw new BoardMoveError(
      409,
      "STALE_BOARD",
      "This task changed. Refresh the board and try again.",
    );
  }
  if (
    requestedLaneById.size !== tasks.length ||
    tasks.some((task) => !requestedLaneById.has(task._id.toString()))
  ) {
    throw new BoardMoveError(409, "STALE_BOARD", "The board changed. Refresh and try again.");
  }

  for (const task of tasks) {
    const id = task._id.toString();
    const expectedStatus = id === move.taskId ? move.toStatus : task.status;
    if (requestedLaneById.get(id) !== expectedStatus) {
      throw new BoardMoveError(
        400,
        "INVALID_ORDER",
        "A move may change only the selected task's status.",
      );
    }

    const editableFields = getEditableTaskFields({
      context,
      task,
      project: {
        id: project._id,
        workspaceId: project.workspaceId,
        projectManagerId: project.projectManagerId,
      },
      isProjectMember,
    });
    if (!editableFields.includes("position") || !editableFields.includes("status")) {
      throw new BoardMoveError(
        403,
        "FORBIDDEN",
        "Only a Project Manager or Admin can reorder board tasks.",
      );
    }
  }

  const affectedStatuses = new Set<BoardStatus>([move.fromStatus, move.toStatus]);
  const operations = [...affectedStatuses].flatMap((status) =>
    move.lanes[status].map((taskId, position) => ({
      updateOne: {
        filter: workspaceScopedFilter(context, { _id: taskId, projectId: project._id }),
        update: { $set: { status, position } },
      },
    })),
  );

  const result = await Task.bulkWrite(operations, { session });
  if (result.matchedCount !== operations.length) {
    throw new BoardMoveError(409, "STALE_BOARD", "The board changed. Refresh and try again.");
  }

  const nextPosition = move.lanes[move.toStatus].indexOf(move.taskId);
  await recordTaskActivity({
    context,
    projectId: project._id,
    taskId: movedTask._id,
    type: "task_reordered",
    changes: [
      { field: "status", from: movedTask.status, to: move.toStatus },
      { field: "position", from: movedTask.position, to: nextPosition },
    ],
    session,
  });
}

function loadProjectTasks(
  context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>,
  projectId: { toString(): string },
  session: mongoose.ClientSession,
) {
  return Task.find(workspaceScopedFilter(context, { projectId }))
    .select(TASK_API_FIELDS)
    .sort({ status: 1, position: 1, createdAt: 1, _id: 1 })
    .session(session)
    .lean();
}
