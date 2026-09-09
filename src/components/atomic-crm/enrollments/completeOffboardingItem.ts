import type { DataProvider, Identifier } from "ra-core";

import type { EnrollmentOffboardingItem, Task } from "../types";

export type CompleteOffboardingItemResult =
  | { status: "done" }
  | { status: "already-done" }
  | { status: "not-found" };

// Client Offboarding slice: the offboarding mirror of
// completeOnboardingItem.ts — identical checklist -> Task sync semantics
// (the DB's own sync_offboarding_item_from_task() trigger handles the
// OTHER direction; this stays application-layer for the same "only one
// write surface" reasoning completeOnboardingItem.ts's own header
// comment explains). Marks the item done and, if it has a linked Task
// that isn't already done/cancelled, completes that Task too. Re-fetches
// the item fresh (never trusts a stale caller copy) so a double-click or
// a stale tab is a safe no-op.
export const completeOffboardingItem = async (
  dataProvider: DataProvider,
  itemId: Identifier,
): Promise<CompleteOffboardingItemResult> => {
  const item = await dataProvider
    .getOne<EnrollmentOffboardingItem>("enrollment_offboarding_items", {
      id: itemId,
    })
    .then(({ data }) => data)
    .catch(() => null);
  if (!item) return { status: "not-found" };
  if (item.status === "done") return { status: "already-done" };

  const completedAt = new Date().toISOString();
  await dataProvider.update("enrollment_offboarding_items", {
    id: item.id,
    data: { status: "done", completed_at: completedAt },
    previousData: item,
  });

  const { data: tasks } = await dataProvider.getList<Task>("tasks", {
    filter: { offboarding_item_id: item.id },
    pagination: { page: 1, perPage: 20 },
    sort: { field: "id", order: "DESC" },
  });
  const activeTask = tasks.find(
    (task) => task.status !== "completed" && task.status !== "cancelled",
  );
  if (activeTask) {
    await dataProvider.update("tasks", {
      id: activeTask.id,
      data: { done_date: completedAt, status: "completed" },
      previousData: activeTask,
    });
  }

  return { status: "done" };
};
