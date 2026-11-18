"use client";

import { useEffect, useRef } from "react";

import type { CompanyRole } from "@/models/User";
import { TaskDetailsWorkspace } from "@/components/tasks/TaskDetailsWorkspace";

export function TaskDetailsDrawer({
  taskId,
  role,
  userId,
  onClose,
  onOpenTask,
}: {
  taskId: string;
  role: CompanyRole;
  userId: string;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Task details"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-white p-0 text-slate-950 backdrop:bg-slate-950/50 md:inset-y-0 md:right-0 md:left-auto md:w-[min(58rem,90vw)] md:shadow-2xl"
    >
      <div className="flex h-full flex-col bg-slate-50">
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
              SprintSpace
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">Task details</p>
          </div>
          <button
            autoFocus
            type="button"
            onClick={onClose}
            aria-label="Close task details"
            className="flex size-10 items-center justify-center rounded-lg text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TaskDetailsWorkspace
            key={taskId}
            taskId={taskId}
            role={role}
            userId={userId}
            presentation="panel"
            onOpenTask={onOpenTask}
          />
        </div>
      </div>
    </dialog>
  );
}
