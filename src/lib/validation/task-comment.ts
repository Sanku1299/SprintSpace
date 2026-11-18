import { z } from "zod";

import { TASK_COMMENT_MAX_LENGTH } from "@/lib/tasks/task-constants";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Enter a valid member identifier.")
  .transform((value) => value.toLowerCase());

const mentionIdsSchema = z
  .array(objectIdSchema)
  .max(50)
  .superRefine((mentionIds, context) => {
    if (new Set(mentionIds).size !== mentionIds.length) {
      context.addIssue({ code: "custom", message: "A member can only be mentioned once." });
    }
  });

const commentContentSchema = z.string().trim().min(1).max(TASK_COMMENT_MAX_LENGTH);

export const createTaskCommentSchema = z
  .object({
    content: commentContentSchema,
    mentionIds: mentionIdsSchema.default([]),
  })
  .strict();

export const updateTaskCommentSchema = z
  .object({
    content: commentContentSchema,
    mentionIds: mentionIdsSchema.optional(),
  })
  .strict();

export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;
export type UpdateTaskCommentInput = z.infer<typeof updateTaskCommentSchema>;
