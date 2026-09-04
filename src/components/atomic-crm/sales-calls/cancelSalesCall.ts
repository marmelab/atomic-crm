import type { DataProvider, Identifier } from "ra-core";

import type { Contact, Deal, SalesCall } from "../types";
import { resolveDefaultTaskSalesId } from "./resolveDefaultTaskSalesId";
import { cancelSalesCallTask } from "./salesCallTask";
import { ensureSalesCallCancelledTask } from "./salesCallCancelledTask";

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
  await ensureFollowUpIfStranded(dataProvider, salesCall);

  return { status: "cancelled", salesCall: updated };
};

// Business invariant (GYU real-infrastructure slice, human-acceptance
// repair pass): NO ACTIVE SALES CALL + OPPORTUNITY STILL CALL_BOOKED must
// always mean a human task stays visible — cancellation alone must never
// let a lead silently strand. Skipped entirely when: the cancelled booking
// was never matched to an Opportunity (nothing to strand); the Opportunity
// already moved past Call Booked by other means (nothing stranded, the
// pipeline is already reflecting reality); or another currently-booked
// call already covers this same Opportunity. That last case is checked
// explicitly rather than assumed — the database's own
// sales_calls_one_booked_per_opportunity_idx already guarantees at most
// one booked call per Opportunity, but relying on that silently here would
// hide the real invariant this function exists to enforce.
const ensureFollowUpIfStranded = async (
  dataProvider: DataProvider,
  cancelledCall: Pick<SalesCall, "opportunity_id" | "contact_id">,
): Promise<void> => {
  if (cancelledCall.opportunity_id == null) return;

  const { data: deal } = await dataProvider
    .getOne<Deal>("deals", { id: cancelledCall.opportunity_id })
    .catch(() => ({ data: null as Deal | null }));
  if (!deal || deal.stage !== "call_booked") return;

  const { data: otherBookedCalls } = await dataProvider.getList<SalesCall>(
    "sales_calls",
    {
      filter: { opportunity_id: deal.id, status: "booked" },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
  );
  if (otherBookedCalls.length > 0) return;

  const { data: contact } = await dataProvider
    .getOne<Contact>("contacts", { id: cancelledCall.contact_id })
    .catch(() => ({ data: null as Contact | null }));
  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : "This contact";

  await ensureSalesCallCancelledTask(dataProvider, {
    contactId: cancelledCall.contact_id,
    contactName,
    salesId: await resolveDefaultTaskSalesId(dataProvider),
  });
};
