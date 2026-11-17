import { z } from "zod";

export const workspaceUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).optional(),
    logo: z.union([z.string().url().max(2048), z.literal("")]).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one workspace field to update.",
  );

export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;
