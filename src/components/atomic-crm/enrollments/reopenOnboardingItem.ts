import type { DataProvider, Identifier } from "ra-core";

import type {
  Deal,
  Enrollment,
  EnrollmentOnboardingItem,
  Task,
} from "../types";

export type ReopenOnboardingItemResult =
  | { status: "reopened" }
  | { status: "already-pending" }
  | { status: "not-found" };

// Contracts + Onboarding slice: unchecking a done item on the Enrollment
// page (architecture review, §8/§10). Always reopens to 'pending' — for
// the 'contract' item specifically this means "unsigning" also forgets
// whether it had been sent; a deliberate v1 simplification, not an
// oversight, since nothing in the approved architecture asked for a finer
// pending/sent distinction on reopen.
//
// If the item's most recent Task is done (not cancelled), reopens that
// SAME Task — mirrors the existing Task checkbox's own uncheck behavior
// exactly. If no active Task exists at all (its Task was cancelled, not
// completed — see sync_onboarding_item_from_task()'s own comment on why
// cancelling never touches the item), a FRESH Task is created instead:
// never resurrects a deliberately-cancelled Task, but never leaves a
// reopened requirement without an active reminder either.
export const reopenOnboardingItem = async (
  dataProvider: DataProvider,
  itemId: Identifier,
): Promise<ReopenOnboardingItemResult> => {
  const item = await dataProvider
    .getOne<EnrollmentOnboardingItem>("enrollment_onboarding_items", {
      id: itemId,
    })
    .then(({ data }) => data)
    .catch(() => null);
  if (!item) return { status: "not-found" };
  if (item.status !== "done") return { status: "already-pending" };

  await dataProvider.update("enrollment_onboarding_items", {
    id: item.id,
    data: { status: "pending", completed_at: null },
    previousData: item,
  });

  const { data: tasks } = await dataProvider.getList<Task>("tasks", {
    filter: { onboarding_item_id: item.id },
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
        type: "onboarding_item",
        text: item.task_text_template.replace("{name}", contactName),
        due_date: new Date().toISOString(),
        status: "pending",
        enrollment_id: item.enrollment_id,
        onboarding_item_id: item.id,
      },
    });
  }

  return { status: "reopened" };
};

const resolveDeal = async (
  dataProvider: DataProvider,
  item: EnrollmentOnboardingItem,
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
