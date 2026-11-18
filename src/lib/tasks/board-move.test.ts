import { describe, expect, it } from "vitest";

import { hasActiveBoardFilters, moveBoardTask } from "./board-move";

const tasks = [
  { id: "a", title: "A", status: "todo" },
  { id: "b", title: "B", status: "todo" },
  { id: "c", title: "C", status: "in_progress" },
];

describe("moveBoardTask", () => {
  it("reorders a task within a status while preserving the other task fields", () => {
    const move = moveBoardTask(tasks, "a", "todo", 1);

    expect(move?.tasks.map((task) => task.id)).toEqual(["b", "a", "c"]);
    expect(move?.tasks[1]).toMatchObject({ id: "a", title: "A", status: "todo" });
  });

  it("moves a task to another status at the requested position", () => {
    const move = moveBoardTask(tasks, "a", "in_progress", 0);

    expect(move).toMatchObject({ fromStatus: "todo", toStatus: "in_progress", taskId: "a" });
    expect(move?.tasks.map((task) => [task.id, task.status])).toEqual([
      ["b", "todo"],
      ["a", "in_progress"],
      ["c", "in_progress"],
    ]);
  });

  it("returns null for a missing task and a no-op drop", () => {
    expect(moveBoardTask(tasks, "missing", "todo", 0)).toBeNull();
    expect(moveBoardTask(tasks, "a", "todo", 0)).toBeNull();
  });
});

describe("hasActiveBoardFilters", () => {
  it("disables drag ordering whenever search or filters are active", () => {
    expect(hasActiveBoardFilters("design", "all", "all")).toBe(true);
    expect(hasActiveBoardFilters("", "urgent", "all")).toBe(true);
    expect(hasActiveBoardFilters("", "all", "unassigned")).toBe(true);
    expect(hasActiveBoardFilters("  ", "all", "all")).toBe(false);
  });
});
