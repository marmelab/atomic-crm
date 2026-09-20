import type { DataProvider, Identifier } from "ra-core";

import type { Task } from "../types";

const SALES_CALL_TASK_TYPE = "sales_call";

// The appointment is not a piece of work — a RETIRED projection.
//
// This type used to be created for every booked call, so the Dashboard
// carried "Sales Call: Sarah Henke — Oct 15, 2026" and "Sales Call:
// Mihaela Petrova — Nov 10, 2026" under Later: rows with a date, a person,
// and nothing for Leif to do about them except attend an appointment the
// CRM already shows him in three truer places — the Call Booked stage, the
// Opportunity's Sales Call section, and the calendar itself. A Task system
// that also lists appointments is a second calendar, and a worse one.
//
// A call may still create work, and each kind says so in its own terms:
//
//   sales_call_needs_matching   nobody knows whose booking this is
//   resolve_sales_call          its time passed and nobody said what happened
//   follow_up                   Leif promised to come back to someone
//
// "The appointment exists" is none of those. So nothing creates this type
// any more (needsAttentionInventory.ts marks it retired, and
// reconcile_sales_call_tasks() closes any that appear), and only the
// closing helpers remain, so a legacy row still resolves through the
// ordinary outcome and cancellation paths instead of being stranded.
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
