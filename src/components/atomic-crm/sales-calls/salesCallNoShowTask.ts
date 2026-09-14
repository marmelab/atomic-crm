import type { DataProvider, Identifier } from "ra-core";

import type { Task } from "../types";

const SALES_CALL_NO_SHOW_TASK_TYPE = "sales_call_no_show";

// Go-Live Blocker: Sales-Call No-Show/Rebooking slice. Mirrors
// salesCallCancelledTask.ts exactly, same underlying visibility gap, same
// principle: completeSalesCallOutcome.ts's no_show branch deliberately
// never regresses the Opportunity's stage (a no-show doesn't tell the CRM
// whether the person wants to reschedule, is genuinely no longer
// interested, or should move to Nurture — that's a human call, "Atomic
// handles certainty, Leif handles ambiguity"). But that restraint has the
// same real cost cancellation already had: the original "Sales Call" task
// is marked done (correctly — the call happened), and without this task
// nothing else ever re-surfaces the decision, so the Opportunity silently
// strands at Call Booked looking exactly like a call is still pending.
// This task exists ONLY to close that visibility gap — never itself a
// sales-status signal, same "Tasks tell the user what to do; sales status
// tells the CRM what happened" separation every task type in this app
// keeps (see followUpTask.ts's own header).
export const findPendingSalesCallNoShowTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
): Promise<Task | null> => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    filter: { contact_id: contactId, type: SALES_CALL_NO_SHOW_TASK_TYPE },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "id", order: "ASC" },
  });
  return data.find((task) => !task.done_date) ?? null;
};

// One pending task at a time per Contact — never a duplicate (e.g. a
// rebooked call that itself later no-shows again before the first task was
// acted on).
export const ensureSalesCallNoShowTask = async (
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
  const existing = await findPendingSalesCallNoShowTask(
    dataProvider,
    contactId,
  );
  if (existing) return;

  await dataProvider.create("tasks", {
    data: {
      contact_id: contactId,
      type: SALES_CALL_NO_SHOW_TASK_TYPE,
      text: `${contactName}'s sales call was a no-show — decide next steps`,
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
export const completeSalesCallNoShowTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
  completedAt: string,
): Promise<void> => {
  const task = await findPendingSalesCallNoShowTask(dataProvider, contactId);
  if (!task) return;
  await dataProvider.update("tasks", {
    id: task.id,
    data: { done_date: completedAt, status: "completed" },
    previousData: task,
  });
};
