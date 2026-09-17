import type { DataProvider, Identifier } from "ra-core";

import type { Task } from "../types";
import { RESOLVE_SALES_CALL_TASK_TYPE } from "./salesCallTaskTypes";
import { formatSalesCallSchedule } from "./salesCallSchedule";
import type { SalesCall } from "../types";

// "This call is attached to the right Opportunity, and nobody ever
// recorded what happened on it."
//
// Distinct from salesCallNeedsMatchingTask.ts, which asks a completely
// different question (WHICH Opportunity?). Clicking this one opens the
// call's own resolution screen showing the three canonical actions — call
// happened / no-show / cancelled — and never the matching screen.
//
// Only ever created deliberately, by whatever noticed the ambiguity. It is
// NOT derived from "attendance is null": 109 attached historical calls in
// production have no attendance because the import recorded their result
// as pipeline stage instead, and turning those into alerts would bury the
// handful of genuinely open questions.
export const findPendingResolveSalesCallTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
  salesCallId?: Identifier,
): Promise<Task | null> => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    filter: { contact_id: contactId, type: RESOLVE_SALES_CALL_TASK_TYPE },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "id", order: "ASC" },
  });
  const pending = data.filter((task) => !task.done_date);
  if (salesCallId != null) {
    const forThisCall = pending.find(
      (task) => String(task.sales_call_id) === String(salesCallId),
    );
    if (forThisCall) return forThisCall;
  }
  return pending.find((task) => task.sales_call_id == null) ?? null;
};

// Reads as the question it is: "Megan Auron · Jul 7, 2026 — what
// happened?". The schedule is formatted through the shared helper so a
// date-only historical call shows its date rather than an invented time.
export const ensureResolveSalesCallTask = async (
  dataProvider: DataProvider,
  {
    contactId,
    contactName,
    salesCall,
    salesId,
  }: {
    contactId: Identifier;
    contactName: string;
    salesCall: Pick<
      SalesCall,
      "id" | "scheduled_at" | "scheduled_on" | "schedule_precision"
    >;
    salesId?: Identifier | null;
  },
): Promise<void> => {
  const existing = await findPendingResolveSalesCallTask(
    dataProvider,
    contactId,
    salesCall.id,
  );
  if (existing) return;

  await dataProvider.create("tasks", {
    data: {
      contact_id: contactId,
      type: RESOLVE_SALES_CALL_TASK_TYPE,
      text: `${contactName} · ${formatSalesCallSchedule(salesCall)} — what happened?`,
      due_date: new Date().toISOString(),
      status: "pending",
      sales_call_id: salesCall.id,
      ...(salesId != null ? { sales_id: salesId } : {}),
    },
  });
};

export const completeResolveSalesCallTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
  completedAt: string,
  salesCallId?: Identifier,
): Promise<void> => {
  const task = await findPendingResolveSalesCallTask(
    dataProvider,
    contactId,
    salesCallId,
  );
  if (!task) return;
  await dataProvider.update("tasks", {
    id: task.id,
    data: { done_date: completedAt, status: "completed" },
    previousData: task,
  });
};
