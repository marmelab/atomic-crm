import type { DataProvider, Identifier } from "ra-core";

import type { Deal, SalesCall, Task } from "../types";
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
// WHAT CHANGED, and why: this function used to leave the Opportunity in
// Call Booked and create a "stranded lead" follow-up task, on the reasoning
// that regressing the stage was a business decision it should not guess.
// The effect was that Call Booked kept asserting a booked call that did not
// exist, and a task was created to compensate for the stage lying. Leif's
// ruling is that Call Booked means exactly one thing — there is a genuine
// booked future call — so the stage now moves to `approved` (approved to
// have a call, none scheduled), which IS the "needs booking" signal the
// stranding task was standing in for. The task is therefore retired rather
// than kept alongside it.
//
// Outcome is still never decided here: whether to pursue somebody who
// cancelled is Leif's judgement (Jori and Brandon cancelled identically and
// got different dispositions), so it stays null and the Deal sits visibly
// at Approved with no call booked.

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

  // 3. The Opportunity leaves Call Booked, because that stage asserts a
  //    booked call and there is none. Only from 'call_booked' and only
  //    while still active: a Deal that has since progressed or exited is
  //    never dragged backwards by cancelling an old call.
  if (salesCall.opportunity_id != null) {
    const { data: deal } = await dataProvider
      .getOne<Deal>("deals", { id: salesCall.opportunity_id })
      .catch(() => ({ data: null as Deal | null }));
    if (
      deal &&
      deal.stage === "call_booked" &&
      deal.outcome == null &&
      deal.archived_at == null
    ) {
      await dataProvider.update<Deal>("deals", {
        id: deal.id,
        data: { stage: "approved", stage_entered_at: now },
        previousData: deal,
      });
    }
  }

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
