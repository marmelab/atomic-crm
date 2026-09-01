import type { DataProvider, Identifier } from "ra-core";

import { dateOnlyToTimestamp } from "../misc/dateOnlyToTimestamp";
import type { Task } from "../types";

const FOLLOW_UP_TASK_TYPE = "follow_up";

// deals.follow_up_date is a bare "YYYY-MM-DD" (a calendar date, not a
// moment in time — see supabase/schemas/01_tables.sql's own comment on
// this column), but tasks.due_date is a real timestamptz and Task.tsx
// always renders it via dealUtils.ts's formatTimestampString, which
// (correctly, per its own header) assumes its input already carries a
// time component. See misc/dateOnlyToTimestamp.ts for why this needs a
// conversion at all, and for the small polish/cleanup slice that also
// reuses it for Task.tsx's postpone-tomorrow/postpone-next-week actions.

// Mirrors applications/reviewApplicationTask.ts's find/ensure/complete
// shape. Created when a completed sales call's prospect decision is
// "Thinking" (sales-calls/completeSalesCallOutcome.ts) — completing or
// cancelling this task never changes deals.prospect_decision/
// follow_up_date itself (Tasks tell the user what to do; sales status
// tells the CRM what happened).
export const findPendingFollowUpTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
): Promise<Task | null> => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    filter: { contact_id: contactId, type: FOLLOW_UP_TASK_TYPE },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "id", order: "ASC" },
  });
  return data.find((task) => !task.done_date) ?? null;
};

// One pending Follow-up task at a time per Contact — a later completed
// call that's Thinking again retargets the existing task rather than
// stacking a second one.
export const ensureFollowUpTask = async (
  dataProvider: DataProvider,
  {
    contactId,
    contactName,
    followUpDate,
    salesId,
  }: {
    contactId: Identifier;
    contactName: string;
    followUpDate: string;
    salesId?: Identifier | null;
  },
): Promise<void> => {
  const dueDate = dateOnlyToTimestamp(followUpDate);
  const existing = await findPendingFollowUpTask(dataProvider, contactId);
  if (existing) {
    if (existing.due_date === dueDate) return;
    await dataProvider.update("tasks", {
      id: existing.id,
      data: { due_date: dueDate },
      previousData: existing,
    });
    return;
  }

  await dataProvider.create("tasks", {
    data: {
      contact_id: contactId,
      type: FOLLOW_UP_TASK_TYPE,
      text: `Follow up with ${contactName}`,
      due_date: dueDate,
      status: "pending",
      ...(salesId != null ? { sales_id: salesId } : {}),
    },
  });
};
