type IdLike = { toString(): string };

export type TaskCommentApiDocument = {
  _id: IdLike;
  workspaceId: IdLike;
  projectId: IdLike;
  taskId: IdLike;
  authorId: IdLike;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskCommentAuthor = {
  _id: IdLike;
  name: string;
  avatarUrl?: string | null;
};

export function toTaskCommentResponse(comment: TaskCommentApiDocument, author?: TaskCommentAuthor) {
  return {
    id: comment._id.toString(),
    workspaceId: comment.workspaceId.toString(),
    projectId: comment.projectId.toString(),
    taskId: comment.taskId.toString(),
    authorId: comment.authorId.toString(),
    authorName: author?.name ?? "Former member",
    authorAvatarUrl: author?.avatarUrl ?? null,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}
