import { z } from "zod";

import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_LABEL_MAX_LENGTH,
  TASK_MAX_EDITORS,
  TASK_MAX_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TITLE_MAX_LENGTH,
} from "@/lib/tasks/task-constants";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Enter a valid identifier.")
  .transform((value) => value.toLowerCase());

const taskDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date in YYYY-MM-DD format.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid calendar date.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const labelsSchema = z
  .array(z.string().trim().min(1).max(TASK_LABEL_MAX_LENGTH))
  .max(TASK_MAX_LABELS)
  .superRefine((labels, context) => {
    const normalizedLabels = labels.map((label) => label.toLowerCase());

    if (new Set(normalizedLabels).size !== normalizedLabels.length) {
      context.addIssue({
        code: "custom",
        message: "Labels must be unique.",
      });
    }
  });

const editorIdsSchema = z
  .array(objectIdSchema)
  .max(TASK_MAX_EDITORS)
  .superRefine((editorIds, context) => {
    if (new Set(editorIds).size !== editorIds.length) {
      context.addIssue({
        code: "custom",
        message: "Each additional editor may be listed only once.",
      });
    }
  });

const createTaskFields = {
  title: z.string().trim().min(2).max(TASK_TITLE_MAX_LENGTH),
  description: z.string().trim().max(TASK_DESCRIPTION_MAX_LENGTH).optional(),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  assigneeId: objectIdSchema.nullable().optional(),
  allowedEditorIds: editorIdsSchema.default([]),
  dueDate: taskDateSchema.optional(),
  labels: labelsSchema.default([]),
  parentTaskId: objectIdSchema.nullable().optional(),
  position: z.number().finite().min(0).default(0),
};

export const createTaskSchema = z.object(createTaskFields).strict();

export const updateTaskSchema = z
  .object({
    title: createTaskFields.title.optional(),
    description: createTaskFields.description,
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: objectIdSchema.nullable().optional(),
    allowedEditorIds: editorIdsSchema.optional(),
    dueDate: taskDateSchema.nullable().optional(),
    labels: labelsSchema.optional(),
    parentTaskId: objectIdSchema.nullable().optional(),
    position: z.number().finite().min(0).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one task field to update.");

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
