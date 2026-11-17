import { z } from "zod";

import { USER_ROLES } from "@/models/User";

export const updateMemberRoleSchema = z
  .object({
    role: z.enum(USER_ROLES),
  })
  .strict();
