type IdLike = { toString(): string };

export type AttachmentApiDocument = {
  _id: IdLike;
  workspaceId: IdLike;
  projectId: IdLike;
  taskId: IdLike;
  uploadedBy: IdLike;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
};

export function toAttachmentResponse(attachment: AttachmentApiDocument) {
  return {
    id: attachment._id.toString(),
    workspaceId: attachment.workspaceId.toString(),
    projectId: attachment.projectId.toString(),
    taskId: attachment.taskId.toString(),
    uploadedBy: attachment.uploadedBy.toString(),
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt.toISOString(),
  };
}
