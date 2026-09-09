import type { DataProvider, Identifier } from "ra-core";

import type {
  Deal,
  Enrollment,
  EnrollmentOffboardingItem,
  Task,
} from "../types";

export type ReopenOffboardingItemResult =
  | { status: "reopened" }
  | { status: "already-pending" }
  | { status: "not-found" };

// Client Offboarding slice: the offboarding mirror of
// reopenOnboardingItem.ts — identical reasoning throughout (human
// checklist correction/reversal, §14 §S): if the item's most recent Task
// is done (not cancelled), reopens that SAME Task, mirroring the Task
// checkbox's own uncheck behavior; if no active Task exists at all (its
// Task was cancelled, not completed), a FRESH Task is created instead —
// never resurrects a deliberately-cancelled Task, but never leaves a
// reopened requirement without an active reminder either.
export const reopenOffboardingItem = async (
  dataProvider: DataProvider,
  itemId: Identifier,
): Promise<ReopenOffboardingItemResult> => {
  const item = await dataProvider
    .getOne<EnrollmentOffboardingItem>("enrollment_offboarding_items", {
      id: itemId,
    })
    .then(({ data }) => data)
    .catch(() => null);
  if (!item) return { status: "not-found" };
  if (item.status !== "done") return { status: "already-pending" };

  await dataProvider.update("enrollment_offboarding_items", {
    id: item.id,
    data: { status: "pending", completed_at: null },
    previousData: item,
  });

  const { data: tasks } = await dataProvider.getList<Task>("tasks", {
    filter: { offboarding_item_id: item.id },
    pagination: { page: 1, perPage: 20 },
    sort: { field: "id", order: "DESC" },
  });
  const doneTask = tasks.find((task) => task.status === "completed");
  if (doneTask) {
    await dataProvider.update("tasks", {
      id: doneTask.id,
      data: { done_date: null, status: "pending" },
      previousData: doneTask,
    });
    return { status: "reopened" };
  }

  const hasActiveTask = tasks.some(
    (task) => task.status !== "completed" && task.status !== "cancelled",
  );
  if (!hasActiveTask) {
    const deal = await resolveDeal(dataProvider, item);
    const contactName = await resolveContactName(dataProvider, deal);
    await dataProvider.create("tasks", {
      data: {
        contact_id: deal.contact_id,
        type: "offboarding_item",
        text: item.task_text_template.replace("{name}", contactName),
        due_date: new Date().toISOString(),
        status: "pending",
        enrollment_id: item.enrollment_id,
        offboarding_item_id: item.id,
      },
    });
  }

  return { status: "reopened" };
};

const resolveDeal = async (
  dataProvider: DataProvider,
  item: EnrollmentOffboardingItem,
): Promise<Deal> => {
  const { data: enrollment } = await dataProvider.getOne<Enrollment>(
    "enrollments",
    { id: item.enrollment_id },
  );
  const { data: deal } = await dataProvider.getOne<Deal>("deals", {
    id: enrollment.opportunity_id,
  });
  return deal;
};

const resolveContactName = async (
  dataProvider: DataProvider,
  deal: Deal,
): Promise<string> => {
  if (!deal.contact_id) return deal.name;
  const { data: contact } = await dataProvider
    .getOne("contacts", { id: deal.contact_id })
    .catch(() => ({
      data: null as { first_name?: string; last_name?: string } | null,
    }));
  const name =
    `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim();
  return name || deal.name;
};
