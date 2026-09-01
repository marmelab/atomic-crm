import type { DataProvider, Identifier } from "ra-core";

import type { Task } from "../types";

const RESOLVE_SALES_CALL_TASK_TYPE = "resolve_sales_call";

// Surfaces a booking that couldn't be safely matched to exactly one active
// Opportunity (Acuity/Sales Call Lifecycle slice, Decision 3: "must not
// become an invisible database record"). Reuses the same Task
// infrastructure/rendering every other task type already gets — no
// dedicated resolution page in this slice, just a task that says what to
// do: "Resolve Sales Call: {Person}". Mirrors applications/
// reviewApplicationTask.ts's find/ensure/complete shape.
export const findPendingResolveSalesCallTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
): Promise<Task | null> => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    filter: { contact_id: contactId, type: RESOLVE_SALES_CALL_TASK_TYPE },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "id", order: "ASC" },
  });
  return data.find((task) => !task.done_date) ?? null;
};

export const ensureResolveSalesCallTask = async (
  dataProvider: DataProvider,
  {
    contactId,
    contactName,
    salesId,
  }: {
    contactId: Identifier;
    contactName: string;
    salesId?: Identifier | null;
  },
): Promise<void> => {
  const existing = await findPendingResolveSalesCallTask(
    dataProvider,
    contactId,
  );
  if (existing) return;

  await dataProvider.create("tasks", {
    data: {
      contact_id: contactId,
      type: RESOLVE_SALES_CALL_TASK_TYPE,
      text: `${contactName} booked a call that couldn't be matched to one Opportunity — pick the right one`,
      due_date: new Date().toISOString(),
      status: "pending",
      ...(salesId != null ? { sales_id: salesId } : {}),
    },
  });
};

export const completeResolveSalesCallTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
  completedAt: string,
): Promise<void> => {
  const task = await findPendingResolveSalesCallTask(dataProvider, contactId);
  if (!task) return;
  await dataProvider.update("tasks", {
    id: task.id,
    data: { done_date: completedAt, status: "completed" },
    previousData: task,
  });
};
