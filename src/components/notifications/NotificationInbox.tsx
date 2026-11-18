"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Notification = {
  id: string;
  projectId: string;
  taskId: string;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export function NotificationInbox() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const fetchNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "Could not load notifications.");
    return payload.data as { notifications: Notification[]; unreadCount: number };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchNotifications()
      .then((data) => {
        if (!active) return;
        setItems(data.notifications);
        setUnread(data.unreadCount);
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Could not load notifications.");
      });
    return () => {
      active = false;
    };
  }, [fetchNotifications]);

  async function markAllRead() {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    if (!response.ok) {
      setError("Could not mark notifications as read.");
      return;
    }
    setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
    setUnread(0);
  }

  async function markRead(item: Notification) {
    if (item.readAt) return;
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: item.id }),
    });
    if (!response.ok) {
      setError("Could not update this notification.");
      return;
    }
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
      ),
    );
    setUnread((current) => Math.max(0, current - 1));
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-indigo-700"
      >
        Alerts
        {unread ? (
          <span className="ml-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <section
          className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          aria-label="Notifications inbox"
        >
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            {unread ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
              >
                Mark all read
              </button>
            ) : null}
          </header>
          {error ? (
            <p role="alert" className="px-4 py-3 text-xs text-rose-700">
              {error}
            </p>
          ) : null}
          <ul className="max-h-[min(70vh,28rem)] divide-y divide-slate-100 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/tasks/${item.taskId}`}
                  onClick={() => void markRead(item)}
                  className={`block px-4 py-3 hover:bg-slate-50 ${item.readAt ? "" : "bg-indigo-50/60"}`}
                >
                  <span className="block text-sm text-slate-800">{item.message}</span>
                  <time className="mt-1 block text-xs text-slate-500" dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </Link>
              </li>
            ))}
            {!items.length ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                You’re all caught up.
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
