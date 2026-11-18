"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import type { CompanyRole } from "@/models/User";

type MentionMember = { id: string; name: string; role: string; avatarUrl: string | null };
type Mention = { id: string; name: string; avatarUrl: string | null };
type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  mentions: Mention[];
  content: string;
  createdAt: string;
  updatedAt: string;
};
type Activity = {
  id: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  type: string;
  changes: Array<{ field: string; from: unknown; to: unknown }>;
  createdAt: string;
};
type Tab = "comments" | "activity";

export function TaskCollaboration({
  taskId,
  userId,
  role,
  projectManagerId,
  members,
  refreshKey,
}: {
  taskId: string;
  userId: string;
  role: CompanyRole;
  projectManagerId: string;
  members: MentionMember[];
  refreshKey: number;
}) {
  const [tab, setTab] = useState<Tab>("comments");
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editMentionIds, setEditMentionIds] = useState<string[]>([]);

  const fetchComments = useCallback(async () => {
    const response = await fetch(`/api/tasks/${taskId}/comments`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "Could not load comments.");
    return payload.data.comments as Comment[];
  }, [taskId]);

  const fetchActivities = useCallback(
    async (before?: string) => {
      const suffix = before ? `?before=${encodeURIComponent(before)}` : "";
      const response = await fetch(`/api/tasks/${taskId}/activity${suffix}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not load activity.");
      return {
        activities: payload.data.activities as Activity[],
        nextCursor: payload.data.nextCursor as string | null,
      };
    },
    [taskId],
  );

  const loadActivities = useCallback(
    async (before?: string, append = false) => {
      const result = await fetchActivities(before);
      setActivities((current) => (append ? [...current, ...result.activities] : result.activities));
      setNextCursor(result.nextCursor);
    },
    [fetchActivities],
  );

  const reloadCollaboration = useCallback(async () => {
    const [loadedComments, loadedActivities] = await Promise.all([
      fetchComments(),
      fetchActivities(),
    ]);
    setComments(loadedComments);
    setActivities(loadedActivities.activities);
    setNextCursor(loadedActivities.nextCursor);
    setError("");
  }, [fetchActivities, fetchComments]);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchComments(), fetchActivities()])
      .then(([loadedComments, loadedActivities]) => {
        if (!active) return;
        setComments(loadedComments);
        setActivities(loadedActivities.activities);
        setNextCursor(loadedActivities.nextCursor);
        setError("");
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Could not load collaboration.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchActivities, fetchComments, refreshKey]);

  const canManage = (comment: Comment) =>
    comment.authorId === userId ||
    role === "admin" ||
    (role === "project_manager" && userId === projectManagerId);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await saveComment(`/api/tasks/${taskId}/comments`, "POST", draft, mentionIds)) {
      setDraft("");
      setMentionIds([]);
    }
  }

  async function saveEdit(commentId: string) {
    if (
      await saveComment(
        `/api/tasks/${taskId}/comments/${commentId}`,
        "PATCH",
        editDraft,
        editMentionIds,
      )
    ) {
      setEditingId(null);
      setEditDraft("");
      setEditMentionIds([]);
    }
  }

  async function saveComment(
    url: string,
    method: "POST" | "PATCH",
    content: string,
    ids: string[],
  ): Promise<boolean> {
    if (!content.trim()) return false;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, mentionIds: ids }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not save comment.");
      await reloadCollaboration();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save comment.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(commentId: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not delete comment.");
      await reloadCollaboration();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete comment.");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditDraft(comment.content);
    setEditMentionIds(comment.mentions.map((mention) => mention.id));
  }

  return (
    <section className="mt-9 border-t border-slate-100 pt-6" aria-label="Task collaboration">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Collaboration</h2>
          <p className="mt-1 text-sm text-slate-500">Discuss work and review task changes.</p>
        </div>
        <div
          className="flex rounded-lg bg-slate-100 p-1"
          role="tablist"
          aria-label="Collaboration views"
        >
          {(["comments", "activity"] as const).map((item) => (
            <button
              key={item}
              id={`collaboration-tab-${item}`}
              role="tab"
              aria-selected={tab === item}
              aria-controls={`collaboration-panel-${item}`}
              onClick={() => setTab(item)}
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${tab === item ? "bg-white text-indigo-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {loading ? <p className="mt-5 text-sm text-slate-500">Loading collaboration…</p> : null}

      <div
        id={`collaboration-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`collaboration-tab-${tab}`}
        className="mt-5"
      >
        {tab === "comments" ? (
          <>
            <form
              onSubmit={submitComment}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <MentionComposer
                content={draft}
                setContent={setDraft}
                mentionIds={mentionIds}
                setMentionIds={setMentionIds}
                members={members}
                disabled={busy}
                label="Write a comment"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Comment"}
                </button>
              </div>
            </form>
            {!loading && comments.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-7 text-center text-sm text-slate-500">
                No comments yet. Start the conversation.
              </p>
            ) : null}
            <ul className="mt-4 space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar name={comment.authorName} src={comment.authorAvatarUrl} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {comment.authorName}
                        </p>
                        <time className="text-xs text-slate-500" dateTime={comment.createdAt}>
                          {timeLabel(comment.createdAt)}
                          {comment.updatedAt !== comment.createdAt ? " · edited" : ""}
                        </time>
                      </div>
                    </div>
                    {canManage(comment) && editingId !== comment.id ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => beginEdit(comment)}
                          className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteComment(comment.id)}
                          disabled={busy}
                          className="text-xs font-semibold text-rose-700 hover:text-rose-900 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {editingId === comment.id ? (
                    <div className="mt-4">
                      <MentionComposer
                        content={editDraft}
                        setContent={setEditDraft}
                        mentionIds={editMentionIds}
                        setMentionIds={setEditMentionIds}
                        members={members}
                        disabled={busy}
                        label="Edit comment"
                      />
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveEdit(comment.id)}
                          disabled={busy || !editDraft.trim()}
                          className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                        {comment.content}
                      </p>
                      {comment.mentions.length ? (
                        <p className="mt-3 flex flex-wrap gap-1.5" aria-label="Mentioned people">
                          {comment.mentions.map((mention) => (
                            <span
                              key={mention.id}
                              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800"
                            >
                              <Avatar name={mention.name} src={mention.avatarUrl} small />@
                              {mention.name}
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            {!loading && activities.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-7 text-center text-sm text-slate-500">
                No activity has been recorded yet.
              </p>
            ) : null}
            <ol className="space-y-0">
              {activities.map((activity) => (
                <li key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
                  <div
                    className="absolute top-9 bottom-0 left-4 w-px bg-slate-200 last:hidden"
                    aria-hidden="true"
                  />
                  <Avatar name={activity.actorName} src={activity.actorAvatarUrl} />
                  <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-sm font-semibold text-slate-900">{activity.actorName}</p>
                      <time className="text-xs text-slate-500" dateTime={activity.createdAt}>
                        {timeLabel(activity.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{activityLabel(activity)}</p>
                  </div>
                </li>
              ))}
            </ol>
            {nextCursor ? (
              <button
                type="button"
                onClick={() =>
                  void loadActivities(nextCursor, true).catch((reason) =>
                    setError(
                      reason instanceof Error ? reason.message : "Could not load more activity.",
                    ),
                  )
                }
                className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Load older activity
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function MentionComposer({
  content,
  setContent,
  mentionIds,
  setMentionIds,
  members,
  disabled,
  label,
}: {
  content: string;
  setContent: (value: string) => void;
  mentionIds: string[];
  setMentionIds: (value: string[] | ((current: string[]) => string[])) => void;
  members: MentionMember[];
  disabled: boolean;
  label: string;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [activeMention, setActiveMention] = useState<{
    start: number;
    end: number;
    query: string;
  } | null>(null);
  const suggestions = useMemo(() => {
    if (!activeMention) return [];
    const query = activeMention.query.toLowerCase();
    return members
      .filter(
        (member) => !mentionIds.includes(member.id) && member.name.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [activeMention, members, mentionIds]);

  function handleChange(value: string, caret: number) {
    setContent(value);
    setMentionIds((current) =>
      current.filter((id) => {
        const member = members.find((item) => item.id === id);
        return member ? value.includes(`@${member.name}`) : false;
      }),
    );
    const match = value.slice(0, caret).match(/@([\p{L}\p{N}_.-]*)$/u);
    if (!match) {
      setActiveMention(null);
      return;
    }
    setActiveMention({ start: caret - match[0].length, end: caret, query: match[1] ?? "" });
  }

  function chooseMention(member: MentionMember) {
    if (!activeMention || !inputRef.current) return;
    const text = `${content.slice(0, activeMention.start)}@${member.name} ${content.slice(activeMention.end)}`;
    const caret = activeMention.start + member.name.length + 2;
    setContent(text);
    setMentionIds((current) => [...current, member.id]);
    setActiveMention(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
    });
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-800">
        {label}
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Type @ to mention an active project member, Admin, or the responsible PM.
        </span>
        <div className="relative">
          <textarea
            ref={inputRef}
            rows={3}
            maxLength={5000}
            value={content}
            disabled={disabled}
            onChange={(event) => handleChange(event.target.value, event.target.selectionStart)}
            placeholder="Share an update…"
            className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
          />
          {activeMention && suggestions.length ? (
            <ul
              role="listbox"
              aria-label="Mention suggestions"
              className="absolute bottom-full left-2 z-10 mb-1 max-h-52 w-[min(20rem,calc(100%-1rem))] overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
            >
              {suggestions.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseMention(member)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-indigo-50"
                  >
                    <Avatar name={member.name} src={member.avatarUrl} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                      {member.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {member.role.replaceAll("_", " ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </label>
      {mentionIds.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Selected mentions">
          {mentionIds.map((id) => {
            const member = members.find((item) => item.id === id);
            return member ? (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => setMentionIds((current) => current.filter((item) => item !== id))}
                className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-60"
                aria-label={`Remove mention of ${member.name}`}
              >
                @{member.name} ×
              </button>
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
}

function Avatar({
  name,
  src,
  small = false,
}: {
  name: string;
  src: string | null;
  small?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const size = small ? "size-4 text-[8px]" : "size-8 text-[10px]";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      aria-hidden="true"
      className={`${size} inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-800`}
    >
      {initials || "?"}
    </span>
  );
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function activityLabel(activity: Activity): string {
  const changes = activity.changes.filter((change) => change.field !== "commentId");
  if (activity.type === "task_created") return "created this task";
  if (activity.type === "task_status_changed") {
    const change = changes.find((item) => item.field === "status");
    return change
      ? `changed status from ${humanValue(change.from)} to ${humanValue(change.to)}`
      : "changed the task status";
  }
  if (activity.type === "task_reordered") return "moved this task on the board";
  if (activity.type === "task_updated")
    return `updated ${changes.map((change) => pretty(change.field)).join(", ") || "this task"}`;
  if (activity.type === "comment_created") return "commented on this task";
  if (activity.type === "comment_updated") return "edited a comment";
  if (activity.type === "comment_deleted") return "deleted a comment";
  return "updated this task";
}

function pretty(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function humanValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "none";
  if (Array.isArray(value)) return value.map(humanValue).join(", ");
  if (typeof value === "object") return "updated value";
  return pretty(String(value));
}
