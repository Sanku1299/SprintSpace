import { z } from "zod";

import {
  PROJECT_KEY_PATTERN,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
} from "@/lib/projects/project-constants";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i)
  .transform((value) => value.toLowerCase());

const projectDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid calendar date.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

function hasValidDateOrder(values: { startDate?: Date | null; endDate?: Date | null }): boolean {
  return !values.startDate || !values.endDate || values.endDate >= values.startDate;
}

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    key: z.string().trim().toUpperCase().regex(PROJECT_KEY_PATTERN).optional(),
    description: z.string().trim().max(3000).optional(),
    status: z.enum(PROJECT_STATUSES).default("planning"),
    priority: z.enum(PROJECT_PRIORITIES).default("medium"),
    projectManagerId: objectIdSchema,
    startDate: projectDateSchema.optional(),
    endDate: projectDateSchema.optional(),
  })
  .strict()
  .refine(hasValidDateOrder, {
    path: ["endDate"],
    message: "End date must be on or after the start date.",
  });

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    key: z.string().trim().toUpperCase().regex(PROJECT_KEY_PATTERN).optional(),
    description: z.string().trim().max(3000).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    priority: z.enum(PROJECT_PRIORITIES).optional(),
    projectManagerId: objectIdSchema.optional(),
    startDate: projectDateSchema.nullable().optional(),
    endDate: projectDateSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one project field to update.")
  .refine(hasValidDateOrder, {
    path: ["endDate"],
    message: "End date must be on or after the start date.",
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
