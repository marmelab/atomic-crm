import type { DataProvider, Identifier } from "ra-core";

import type { Task } from "../types";

const SALES_CALL_TASK_TYPE = "sales_call";

// Mirrors applications/reviewApplicationTask.ts's own find/ensure/complete
// shape exactly (Task's only link to a Contact is contact_id — no
// sales_call_id FK on Task, same documented limitation as that module).
export const findPendingSalesCallTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
): Promise<Task | null> => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    filter: { contact_id: contactId, type: SALES_CALL_TASK_TYPE },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "id", order: "ASC" },
  });
  return data.find((task) => !task.done_date) ?? null;
};

// Creates (or, on a reschedule, retargets) the "Sales Call" task for a
// newly booked call — never a duplicate for the same pending call.
export const ensureSalesCallTask = async (
  dataProvider: DataProvider,
  {
    contactId,
    contactName,
    scheduledAt,
    salesId,
  }: {
    contactId: Identifier;
    contactName: string;
    scheduledAt: string;
    salesId?: Identifier | null;
  },
): Promise<void> => {
  const existing = await findPendingSalesCallTask(dataProvider, contactId);
  if (existing) {
    if (existing.due_date === scheduledAt) return;
    await dataProvider.update("tasks", {
      id: existing.id,
      data: { due_date: scheduledAt },
      previousData: existing,
    });
    return;
  }

  await dataProvider.create("tasks", {
    data: {
      contact_id: contactId,
      type: SALES_CALL_TASK_TYPE,
      text: `Sales call with ${contactName}`,
      due_date: scheduledAt,
      status: "pending",
      ...(salesId != null ? { sales_id: salesId } : {}),
    },
  });
};

// A reschedule keeps the same task, just retargeted to the new time — never
// a second "Sales Call" task for the same still-pending call.
export const updateSalesCallTaskDueDate = async (
  dataProvider: DataProvider,
  contactId: Identifier,
  scheduledAt: string,
): Promise<void> => {
  const task = await findPendingSalesCallTask(dataProvider, contactId);
  if (!task || task.due_date === scheduledAt) return;
  await dataProvider.update("tasks", {
    id: task.id,
    data: { due_date: scheduledAt },
    previousData: task,
  });
};

// A cancelled call has no more pending action attached to it — cancel
// (never delete) the task, mirroring the Task infrastructure's own
// "waiting"/"cancelled" states (tasks are reminders, not sales-status
// controls, so this only ever touches the Task, never the Opportunity).
export const cancelSalesCallTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
): Promise<void> => {
  const task = await findPendingSalesCallTask(dataProvider, contactId);
  if (!task) return;
  await dataProvider.update("tasks", {
    id: task.id,
    data: { status: "cancelled" },
    previousData: task,
  });
};

// The call happened (attended or no-show) — its "have the call" task is
// done either way. Completing it here is what marks it done, never the
// reverse: checking the task off manually must never change sales status
// (see sales-calls/completeSalesCallOutcome.ts, which is the only caller).
export const completeSalesCallTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
  completedAt: string,
): Promise<void> => {
  const task = await findPendingSalesCallTask(dataProvider, contactId);
  if (!task) return;
  await dataProvider.update("tasks", {
    id: task.id,
    data: { done_date: completedAt, status: "completed" },
    previousData: task,
  });
};
