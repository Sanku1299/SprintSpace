export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "archived"] as const;

export const PROJECT_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];
