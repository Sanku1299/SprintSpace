type IdLike = { toString(): string };

export type TaskCommentApiDocument = {
  _id: IdLike;
  workspaceId: IdLike;
  projectId: IdLike;
  taskId: IdLike;
  authorId: IdLike;
  mentionIds: IdLike[];
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskCommentAuthor = {
  _id: IdLike;
  name: string;
  avatarUrl?: string | null;
};

export type TaskCommentMention = {
  _id: IdLike;
  name: string;
  avatarUrl?: string | null;
};

export function toTaskCommentResponse(
  comment: TaskCommentApiDocument,
  author?: TaskCommentAuthor,
  mentionsById: ReadonlyMap<string, TaskCommentMention> = new Map(),
) {
  return {
    id: comment._id.toString(),
    workspaceId: comment.workspaceId.toString(),
    projectId: comment.projectId.toString(),
    taskId: comment.taskId.toString(),
    authorId: comment.authorId.toString(),
    authorName: author?.name ?? "Former member",
    authorAvatarUrl: author?.avatarUrl ?? null,
    mentions: (comment.mentionIds ?? []).map((mentionId) => {
      const mentionedUser = mentionsById.get(mentionId.toString());
      return {
        id: mentionId.toString(),
        name: mentionedUser?.name ?? "Former member",
        avatarUrl: mentionedUser?.avatarUrl ?? null,
      };
    }),
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}
