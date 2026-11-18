import { z } from "zod";

import { TASK_COMMENT_MAX_LENGTH } from "@/lib/tasks/task-constants";

export const taskCommentSchema = z
  .object({
    content: z.string().trim().min(1).max(TASK_COMMENT_MAX_LENGTH),
  })
  .strict();

export type TaskCommentInput = z.infer<typeof taskCommentSchema>;
