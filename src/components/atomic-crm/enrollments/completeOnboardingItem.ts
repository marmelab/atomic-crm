import type { DataProvider, Identifier } from "ra-core";

import type { EnrollmentOnboardingItem, Task } from "../types";

export type CompleteOnboardingItemResult =
  | { status: "done" }
  | { status: "already-done" }
  | { status: "not-found" };

// Contracts + Onboarding slice: the checklist -> Task half of the two-way
// sync (architecture review, §8). The DB's own sync_onboarding_item_from_task()
// trigger (02_functions.sql) handles the OTHER direction — a Task's own
// completion/reopening syncs onto its linked item. This direction stays
// application-layer rather than a second DB trigger: checklist items only
// have one write surface in this slice (the Enrollment page), so there's
// no "many entry points" risk to guard against at the DB level the way
// Task edits (checkbox, edit sheet, mobile list) already have.
//
// Marks the item done and, if it has a linked Task that isn't already
// done/cancelled, completes that Task too — the checklist is the durable
// source of truth Leif approved; completing it here IS what "the work got
// done" means, whether or not a Task happens to exist for it. Re-fetches
// the item fresh (never trusts a stale caller copy) so a double-click or a
// stale tab is a safe no-op, same idempotent-re-fetch shape as
// reviewApplication.ts.
export const completeOnboardingItem = async (
  dataProvider: DataProvider,
  itemId: Identifier,
): Promise<CompleteOnboardingItemResult> => {
  const item = await dataProvider
    .getOne<EnrollmentOnboardingItem>("enrollment_onboarding_items", {
      id: itemId,
    })
    .then(({ data }) => data)
    .catch(() => null);
  if (!item) return { status: "not-found" };
  if (item.status === "done") return { status: "already-done" };

  const completedAt = new Date().toISOString();
  await dataProvider.update("enrollment_onboarding_items", {
    id: item.id,
    data: { status: "done", completed_at: completedAt },
    previousData: item,
  });

  const { data: tasks } = await dataProvider.getList<Task>("tasks", {
    filter: { onboarding_item_id: item.id },
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
