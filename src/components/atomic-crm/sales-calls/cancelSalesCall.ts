import type { DataProvider, Identifier } from "ra-core";

import type { SalesCall, Task } from "../types";
import { cancelSalesCallTask } from "./salesCallTask";

// The ONE canonical cancellation, used by BOTH entry points: the manual
// "Cancelled" choice in Complete Sales Call, and the Acuity webhook when a
// client cancels their own booking. Production runs it as a single Postgres
// transaction (record_sales_call_cancelled); this module is the
// FakeRest-testable mirror, the same dual-implementation pattern as
// recordSalesCallNoShow.ts.
//
// A cancellation is NOT a no-show. A no-show says the person did not turn
// up — a fact about them, which earns a durable Contact tag. A cancellation
// says the meeting is not happening, which says nothing about whether they
// are still interested. So this never touches `attendance`, never attaches
// the No-show tag, and never sets an exit outcome.
//
// The Opportunity's stage is not touched. There was a period when it was:
// the stage moved back to `approved` on the reasoning that Call Booked
// asserts a booked call and a cancelled one is not booked. Acceptance
// testing retired that. `approved` means "qualified, waiting to book",
// which is where somebody is BEFORE they ever agreed to meet, so writing
// it moved people backwards through the sales process on a fact that says
// nothing about how far the sale had got.
//
// Outcome is never decided here either: whether to pursue somebody who
// cancelled is Leif's judgement (Jori and Brandon cancelled identically
// and got different dispositions). It stays null, the card stays where the
// sale reached, and deals/needsNextSalesStep.ts surfaces the open question
// from the call facts rather than from the stage.

export type CancelSalesCallResult =
  | { status: "cancelled" }
  // A duplicate cancellation — a repeated webhook or a second click — is a
  // safe no-op rather than a second event.
  | { status: "already-cancelled" }
  | { status: "not-found" }
  // Someone attended it; cancelling afterwards would erase that.
  | { status: "already-attended" };

type CancelCapableProvider = DataProvider & {
  recordSalesCallCancelled?: (
    salesCallId: Identifier,
  ) => Promise<{ status: string }>;
};

// Entry point for callers: the transactional RPC where the provider offers
// one, the mirror below otherwise.
export const cancelSalesCall = async (
  dataProvider: DataProvider,
  salesCallId: Identifier,
): Promise<CancelSalesCallResult> => {
  const rpc = (dataProvider as CancelCapableProvider).recordSalesCallCancelled;
  if (typeof rpc === "function") {
    const result = await rpc(salesCallId);
    return { status: result.status } as CancelSalesCallResult;
  }
  return cancelSalesCallMirror(dataProvider, salesCallId);
};

// The step-by-step implementation, exported so a provider that registers
// itself as RPC-capable can point straight at it instead of having
// cancelSalesCall dispatch back into that same registration forever.
export const cancelSalesCallMirror = async (
  dataProvider: DataProvider,
  salesCallId: Identifier,
): Promise<CancelSalesCallResult> => {
  const { data: salesCall } = await dataProvider
    .getOne<SalesCall>("sales_calls", { id: salesCallId })
    .catch(() => ({ data: null as SalesCall | null }));
  if (!salesCall) return { status: "not-found" };
  if (salesCall.attendance === "attended") {
    return { status: "already-attended" };
  }
  if (salesCall.status === "cancelled") {
    return { status: "already-cancelled" };
  }

  const now = new Date().toISOString();

  // 1. The Sales Call is the canonical record of the cancellation.
  //    original_scheduled_at is untouched — when it WAS going to happen is
  //    part of the history — and status leaving 'booked' frees the
  //    one-booked-per-opportunity index for a genuine rebooking.
  await dataProvider.update<SalesCall>("sales_calls", {
    id: salesCall.id,
    data: {
      status: "cancelled",
      cancelled_at: salesCall.cancelled_at ?? now,
    },
    previousData: salesCall,
  });
  await dataProvider.create("sales_call_events", {
    data: { sales_call_id: salesCall.id, kind: "cancelled", occurred_at: now },
  });

  // 2. A task about this specific call is no longer real work. Cancelled
  //    rather than completed — nobody did it — and deliberately with no
  //    done_date.
  //    Two passes, because a booking task can be linked either way: the
  //    Acuity booking task is created against the CONTACT (the existing
  //    cancelSalesCallTask helper finds it), while tasks created later
  //    carry sales_call_id directly. Cancelling by only one of those left
  //    the other falsely pending.
  await cancelSalesCallTask(dataProvider, salesCall.contact_id);
  await cancelTasksForCall(dataProvider, salesCall.id);

  // 3. The Opportunity is NOT touched.
  //
  //    This used to write the stage back to 'approved', because Call
  //    Booked asserts a booked call and there is none. But 'approved'
  //    means "qualified, waiting to book" — where somebody is BEFORE they
  //    have ever agreed to meet — so writing it moved a person backwards
  //    through the sales process on the strength of a fact that says
  //    nothing about how far the sale has got. Owner decision, after
  //    acceptance testing found four people demoted that way.
  //
  //    What happens next is still surfaced, just not by moving the card:
  //    deals/needsNextSalesStep.ts derives it from active + latest call
  //    cancelled/no-show + nothing booked since, independently of stage.

  return { status: "cancelled" };
};

const cancelTasksForCall = async (
  dataProvider: DataProvider,
  salesCallId: Identifier,
): Promise<void> => {
  const { data: tasks } = await dataProvider.getList<Task>("tasks", {
    filter: { sales_call_id: salesCallId },
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });
  for (const task of tasks) {
    if (task.status !== "pending" && task.status !== "waiting") continue;
    await dataProvider.update<Task>("tasks", {
      id: task.id,
      // No done_date: a cancelled task was never done.
      data: { status: "cancelled" },
      previousData: task,
    });
  }
};
