export type ProjectListItem = {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string;
  status: string;
  priority: string;
  projectManagerId: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
};
