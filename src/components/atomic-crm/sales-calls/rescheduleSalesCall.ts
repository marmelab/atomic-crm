import type { DataProvider, Identifier } from "ra-core";

import type { SalesCall } from "../types";
import { updateSalesCallTaskDueDate } from "./salesCallTask";

export type RescheduleSalesCallResult =
  | { status: "rescheduled"; salesCall: SalesCall }
  | { status: "not-found" }
  // Same new time already recorded — a duplicate reschedule webhook is a
  // safe no-op, never a second event.
  | { status: "already-current"; salesCall: SalesCall }
  | { status: "cancelled-call" };

// A reschedule updates the SAME sales_calls row — it must never look like
// two independent calls in later conversion analytics (Leif's own
// requirement). original_scheduled_at never changes; scheduled_at moves,
// reschedule_count increments, and the fact is preserved individually in
// sales_call_events (not just the running count) per Leif's Decision 1
// addition.
export const rescheduleSalesCall = async (
  dataProvider: DataProvider,
  {
    salesCallId,
    newScheduledAt,
  }: { salesCallId: Identifier; newScheduledAt: string },
): Promise<RescheduleSalesCallResult> => {
  const { data: salesCall } = await dataProvider
    .getOne<SalesCall>("sales_calls", { id: salesCallId })
    .catch(() => ({ data: null as SalesCall | null }));
  if (!salesCall) return { status: "not-found" };
  if (salesCall.status === "cancelled") return { status: "cancelled-call" };
  if (salesCall.scheduled_at === newScheduledAt) {
    return { status: "already-current", salesCall };
  }

  const now = new Date().toISOString();
  const previousScheduledAt = salesCall.scheduled_at;
  const { data: updated } = await dataProvider.update<SalesCall>(
    "sales_calls",
    {
      id: salesCallId,
      data: {
        scheduled_at: newScheduledAt,
        reschedule_count: salesCall.reschedule_count + 1,
        last_rescheduled_at: now,
      },
      previousData: salesCall,
    },
  );

  await dataProvider.create("sales_call_events", {
    data: {
      sales_call_id: salesCallId,
      kind: "rescheduled",
      occurred_at: now,
      previous_scheduled_at: previousScheduledAt,
      new_scheduled_at: newScheduledAt,
    },
  });

  // Never touches Opportunity stage — a reschedule is the same call moving
  // in time, not a pipeline event. Only the Sales Call Task's due date
  // (when the Opportunity was matched and a task exists) moves with it.
  await updateSalesCallTaskDueDate(
    dataProvider,
    salesCall.contact_id,
    newScheduledAt,
  );

  return { status: "rescheduled", salesCall: updated };
};
