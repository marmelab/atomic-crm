import type { DataProvider, Identifier } from "ra-core";

import type { SalesCall } from "../types";
import { cancelSalesCallTask } from "./salesCallTask";

export type CancelSalesCallResult =
  | { status: "cancelled"; salesCall: SalesCall }
  | { status: "not-found" }
  // Already cancelled — a duplicate cancellation webhook is a safe no-op.
  | { status: "already-cancelled"; salesCall: SalesCall };

// Cancelling never regresses the Opportunity's stage (a human/business
// call, not something this function should guess — see this slice's
// report) — it only marks the call itself cancelled, records the event,
// and cancels the now-pointless "Sales Call" task. If the call gets
// rebooked later, bookSalesCall.ts/rescheduleSalesCall.ts handle that as
// their own event.
export const cancelSalesCall = async (
  dataProvider: DataProvider,
  salesCallId: Identifier,
): Promise<CancelSalesCallResult> => {
  const { data: salesCall } = await dataProvider
    .getOne<SalesCall>("sales_calls", { id: salesCallId })
    .catch(() => ({ data: null as SalesCall | null }));
  if (!salesCall) return { status: "not-found" };
  if (salesCall.status === "cancelled") {
    return { status: "already-cancelled", salesCall };
  }

  const now = new Date().toISOString();
  const { data: updated } = await dataProvider.update<SalesCall>(
    "sales_calls",
    {
      id: salesCallId,
      data: { status: "cancelled", cancelled_at: now },
      previousData: salesCall,
    },
  );

  await dataProvider.create("sales_call_events", {
    data: { sales_call_id: salesCallId, kind: "cancelled", occurred_at: now },
  });

  await cancelSalesCallTask(dataProvider, salesCall.contact_id);

  return { status: "cancelled", salesCall: updated };
};
