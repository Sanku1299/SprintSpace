import "server-only";

import { Project } from "@/models/Project";
import { Workspace } from "@/models/Workspace";

export async function allocateProjectKey(workspaceId: string): Promise<string> {
  const workspace = await Workspace.findById(workspaceId).select("projectSequence").lean();

  if (!workspace) {
    throw new Error("Workspace not found while allocating a project number.");
  }

  if (typeof workspace.projectSequence !== "number") {
    const projectsWithNumbers = await Project.find({
      workspaceId,
      key: /^\d+$/,
    })
      .select("key")
      .lean();
    const highestExistingNumber = projectsWithNumbers.reduce(
      (highest, project) => Math.max(highest, Number(project.key)),
      0,
    );
    await Workspace.updateOne(
      { _id: workspaceId, projectSequence: { $exists: false } },
      { $set: { projectSequence: highestExistingNumber } },
    );
  }

  const updatedWorkspace = await Workspace.findOneAndUpdate(
    { _id: workspaceId },
    { $inc: { projectSequence: 1 } },
    { new: true },
  )
    .select("projectSequence")
    .lean();

  if (typeof updatedWorkspace?.projectSequence !== "number") {
    throw new Error("Could not allocate a project number.");
  }

  return String(updatedWorkspace.projectSequence);
}
