import { ProjectBoardWorkspace } from "@/components/tasks/ProjectBoardWorkspace";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function ProjectBoardPage({ params }: PageProps) {
  const { projectId } = await params;

  return <ProjectBoardWorkspace projectId={projectId} />;
}
