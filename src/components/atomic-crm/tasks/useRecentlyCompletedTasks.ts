import { useCallback, useMemo, useState } from "react";
import type { Identifier } from "ra-core";

import type { Task as TaskType } from "../types";

// Human-acceptance repair (Tasks noise): a just-completed Task stays
// visible, checked and muted, for a brief confirmation window instead of
// vanishing the instant its optimistic done_date lands (so Leif sees the
// check register) or lingering indefinitely mixed into the actionable
// list (the "growing graveyard of crossed-out tasks" human acceptance
// found). Originally inlined in DashboardTasks.tsx (its own comment
// explains why this is deliberately much shorter than tasksPredicate.ts's
// `isRecentlyDone`, a *5-minute* grace window built for a different
// purpose — avoiding flicker on an already-open list, not a completion
// acknowledgement); extracted here so ClientShow's/ContactShow's own Task
// lists (TasksListByDueDate) get the exact same short, deterministic
// removal instead of inheriting the 5-minute one. Purely a CLIENT-SIDE
// display-timing concern — the underlying done_date/status write already
// happened (or didn't) via the real mutation; this never touches server
// state, so a page reload or navigation mid-window simply shows the
// Task's real, already-persisted status with no grace period at all
// (never a source of truth on its own).
const CONFIRMATION_WINDOW_MS = 1500;

export const useRecentlyCompletedTasks = () => {
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<
    Set<Identifier>
  >(new Set());

  const markCompleted = useCallback((task: Pick<TaskType, "id">) => {
    setRecentlyCompletedIds((prev) => new Set(prev).add(task.id));
    setTimeout(() => {
      setRecentlyCompletedIds((prev) => {
        if (!prev.has(task.id)) return prev;
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }, CONFIRMATION_WINDOW_MS);
  }, []);

  const isRecentlyCompleted = useCallback(
    (id: Identifier) => recentlyCompletedIds.has(id),
    [recentlyCompletedIds],
  );

  return useMemo(
    () => ({ isRecentlyCompleted, markCompleted }),
    [isRecentlyCompleted, markCompleted],
  );
};
