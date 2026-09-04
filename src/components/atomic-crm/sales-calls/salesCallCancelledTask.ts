import type { DataProvider, Identifier } from "ra-core";

import type { Task } from "../types";

const SALES_CALL_CANCELLED_TASK_TYPE = "sales_call_cancelled";

// Business-workflow gap found via real human Acuity acceptance testing
// (GYU real-infrastructure slice): cancelSalesCall.ts deliberately never
// regresses the Opportunity's stage on cancellation — cancellation alone
// doesn't tell the CRM whether the person wants to reschedule, changed
// their mind, or had a scheduling conflict, so guessing a new stage would
// be worse than leaving it alone (see cancelSalesCall.ts's own comment).
// But that restraint has a real cost: an Opportunity left at "Call Booked"
// with no active appointment and no task is a lead silently stranding,
// with nobody deciding what happens next. This task exists ONLY to close
// that visibility gap — it is never itself a sales-status signal (same
// separation every other task type in this app already keeps: "Tasks tell
// the user what to do; sales status tells the CRM what happened", see
// followUpTask.ts's own header). Mirrors applications/
// reviewApplicationTask.ts's find/ensure/complete shape.
export const findPendingSalesCallCancelledTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
): Promise<Task | null> => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    filter: { contact_id: contactId, type: SALES_CALL_CANCELLED_TASK_TYPE },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "id", order: "ASC" },
  });
  return data.find((task) => !task.done_date) ?? null;
};

// One pending task at a time per Contact — never a duplicate (e.g. if a
// fresh booking for the same Opportunity were itself later cancelled again
// before anyone acted on the first task).
export const ensureSalesCallCancelledTask = async (
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
  const existing = await findPendingSalesCallCancelledTask(
    dataProvider,
    contactId,
  );
  if (existing) return;

  await dataProvider.create("tasks", {
    data: {
      contact_id: contactId,
      type: SALES_CALL_CANCELLED_TASK_TYPE,
      text: `${contactName}'s sales call was cancelled — decide next steps`,
      due_date: new Date().toISOString(),
      status: "pending",
      ...(salesId != null ? { sales_id: salesId } : {}),
    },
  });
};

// A fresh booking for the same Opportunity is the resolution: the person
// is back on the calendar, so the "decide what happens next" task is done.
// Never the reverse — completing it manually must never affect sales
// status, same rule as every other task-completion function in this app.
export const completeSalesCallCancelledTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
  completedAt: string,
): Promise<void> => {
  const task = await findPendingSalesCallCancelledTask(dataProvider, contactId);
  if (!task) return;
  await dataProvider.update("tasks", {
    id: task.id,
    data: { done_date: completedAt, status: "completed" },
    previousData: task,
  });
};
