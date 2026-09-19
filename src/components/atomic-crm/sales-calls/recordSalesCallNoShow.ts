import type { DataProvider, Identifier } from "ra-core";

import type { Contact, Deal, SalesCall, Tag, Task } from "../types";
import { completeResolveSalesCallTask } from "./resolveSalesCallTask";
import { isActiveOpportunity } from "../deals/dealActivity";

// Gate B — the dev/FakeRest half of the dual-implementation No-show path.
// The production path is the Postgres function
// record_sales_call_no_show() (supabase/schemas/02_functions.sql), which
// applies all of this in ONE transaction. This module is the
// FakeRest-testable "logic of record" the function mirrors — the same
// dual-implementation pattern already used for public application intake
// (submit_public_application() <-> submitApplication.ts) and waitlist sync
// (deal_waitlist_sync trigger <-> waitlistSync.ts).
//
// The rule, CHANGED in the sales-state-machine slice: a no-show is a fact
// about a call, not a decision about a person.
//
// This used to set outcome = 'lost', which ended the sales attempt
// automatically. Alva Winsa is still terminal because of it — nobody
// decided that, a missed meeting did. "They did not turn up" does not
// answer "are we done?", "will they rebook?" or "should they nurture?",
// and a system that answers those questions on Leif's behalf is inventing
// business decisions.
//
// So now —
//   Sales Call  canonical history: attendance 'no_show', status 'completed'
//   Opportunity stays ACTIVE, and returns from Call Booked to Approved
//               because that stage asserts a booked call and there is none
//   Contact     carries a durable, visible "No-show" tag
//   Outcome     untouched. Ending the attempt is an explicit human action
//   Decision    untouched. Missing a call is not the prospect saying no
//
// What replaces the automatic exit is a DERIVED condition — active
// Opportunity, latest call cancelled or no-show, nothing booked since —
// computed in deals/needsNextSalesStep.ts. It cannot be deleted, because
// it is not stored.

export const NO_SHOW_TAG_NAME = "No-show";
// Same palette the manual tag UI uses (tags/colors.ts).
const NO_SHOW_TAG_COLOR = "#fde2e4";

export type RecordSalesCallNoShowResult =
  | { status: "completed" }
  // Re-running the action on an already-no-showed call. Safe and
  // convergent: it re-asserts the tag and the stage rather than
  // duplicating anything.
  | { status: "already-no-show" }
  | { status: "not-found" }
  | { status: "no-opportunity" }
  // An attended outcome is already recorded; never silently overwritten.
  | { status: "already-completed" };

// The Supabase provider exposes the real transactional path; FakeRest and
// unit tests fall through to the mirror below.
type NoShowCapableProvider = DataProvider & {
  recordSalesCallNoShow?: (
    salesCallId: Identifier,
  ) => Promise<{ status: string }>;
};

export const recordSalesCallNoShow = async (
  dataProvider: DataProvider,
  salesCallId: Identifier,
): Promise<RecordSalesCallNoShowResult> => {
  const rpc = (dataProvider as NoShowCapableProvider).recordSalesCallNoShow;
  if (typeof rpc === "function") {
    const result = await rpc(salesCallId);
    return { status: result.status } as RecordSalesCallNoShowResult;
  }

  const { data: salesCall } = await dataProvider
    .getOne<SalesCall>("sales_calls", { id: salesCallId })
    .catch(() => ({ data: null as SalesCall | null }));
  if (!salesCall) return { status: "not-found" };
  if (salesCall.opportunity_id == null) return { status: "no-opportunity" };
  if (salesCall.attendance === "attended") {
    return { status: "already-completed" };
  }

  const alreadyNoShow = salesCall.attendance === "no_show";
  const now = new Date().toISOString();

  // 1. Sales Call — the canonical historical record. status leaves
  //    'booked' so a later genuine rebooking is not blocked by the partial
  //    unique index on (opportunity_id) WHERE status = 'booked'.
  if (!alreadyNoShow) {
    await dataProvider.update<SalesCall>("sales_calls", {
      id: salesCall.id,
      data: {
        attendance: "no_show",
        attendance_recorded_at: now,
        status: "completed",
      },
      previousData: salesCall,
    });
    await dataProvider.create("sales_call_events", {
      data: {
        sales_call_id: salesCall.id,
        kind: "attendance_recorded",
        occurred_at: now,
        attendance: "no_show",
      },
    });
  } else if (salesCall.status !== "completed") {
    // Already recorded as a no-show but never concluded: a row written
    // before a concluded call was required to leave 'booked'. Converge the
    // status WITHOUT inventing a second attendance timestamp or a
    // duplicate history event — the original attendance_recorded_at is the
    // truth about when it was observed. Leaving it at 'booked' would keep
    // blocking a genuine rebooking via the partial unique index.
    await dataProvider.update<SalesCall>("sales_calls", {
      id: salesCall.id,
      data: { status: "completed" },
      previousData: salesCall,
    });
  }

  // 2. The Opportunity stays an active sales attempt. Only the stage
  //    moves, and only because Call Booked asserts a booked call that no
  //    longer exists — the same regression a cancellation performs. If a
  //    later booking already exists the stage is already telling the
  //    truth, so it is left alone.
  //
  //    outcome is NOT set. prospect_decision is NOT set. Ending the
  //    attempt is an explicit decision with its own action and its own
  //    outcome event.
  const { data: deal } = await dataProvider.getOne<Deal>("deals", {
    id: salesCall.opportunity_id,
  });
  if (isActiveOpportunity(deal) && deal.stage === "call_booked") {
    const { data: calls } = await dataProvider.getList<SalesCall>(
      "sales_calls",
      {
        filter: { opportunity_id: deal.id },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "id", order: "ASC" },
      },
    );
    const stillBooked = calls.some(
      (call) =>
        String(call.id) !== String(salesCall.id) && call.status === "booked",
    );
    if (!stillBooked) {
      await dataProvider.update<Deal>("deals", {
        id: deal.id,
        data: { stage: "approved", stage_entered_at: now },
        previousData: deal,
      });
    }
  }

  // 3. Contact-level visible history, reusing the existing tag model.
  await ensureNoShowTag(dataProvider, salesCall.contact_id);

  // 4. The call concluded, so its own task is done. No follow-up task is
  //    invented here: the open question — what happens next with this
  //    person — is DERIVED by deals/needsNextSalesStep.ts, so a task
  //    duplicating it could be deleted while the question remained. A
  //    'sales_call_no_show' task left pending by the previous behavior is
  //    superseded work, closed here rather than left behind.
  await completePendingTasks(dataProvider, salesCall.contact_id, now);
  // "No-show" is one of the three canonical answers to "what happened on
  // this call?", so a resolve_sales_call ambiguity task for THIS call is
  // answered by it. Scoped by sales_call_id rather than swept up by
  // contact above, because a returning Contact can have an open question
  // about a different call that this one does not answer.
  await completeResolveSalesCallTask(
    dataProvider,
    salesCall.contact_id,
    now,
    salesCall.id,
  );

  return { status: alreadyNoShow ? "already-no-show" : "completed" };
};

// Attaches the No-show tag exactly once, creating the tag itself only if
// the workspace does not already have one. Matched case-insensitively so a
// manually-created "No-Show" is reused rather than duplicated.
const ensureNoShowTag = async (
  dataProvider: DataProvider,
  contactId: Identifier,
): Promise<void> => {
  const { data: tags } = await dataProvider.getList<Tag>("tags", {
    filter: {},
    pagination: { page: 1, perPage: 500 },
    sort: { field: "id", order: "ASC" },
  });
  let tag =
    tags.find(
      (t) => t.name?.toLowerCase() === NO_SHOW_TAG_NAME.toLowerCase(),
    ) ?? null;
  if (!tag) {
    const { data: created } = await dataProvider.create<Tag>("tags", {
      data: {
        name: NO_SHOW_TAG_NAME,
        color: NO_SHOW_TAG_COLOR,
      } as Partial<Tag>,
    });
    tag = created;
  }

  const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
    id: contactId,
  });
  const current = contact.tags ?? [];
  if (current.some((id) => String(id) === String(tag!.id))) return;
  await dataProvider.update<Contact>("contacts", {
    id: contact.id,
    data: { tags: [...current, tag.id] },
    previousData: contact,
  });
};

const completePendingTasks = async (
  dataProvider: DataProvider,
  contactId: Identifier,
  completedAt: string,
): Promise<void> => {
  const { data: tasks } = await dataProvider.getList<Task>("tasks", {
    filter: { contact_id: contactId },
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });
  const superseded = tasks.filter(
    (task) =>
      !task.done_date &&
      (task.type === "sales_call" || task.type === "sales_call_no_show"),
  );
  for (const task of superseded) {
    await dataProvider.update<Task>("tasks", {
      id: task.id,
      data: { done_date: completedAt, status: "completed" },
      previousData: task,
    });
  }
};
