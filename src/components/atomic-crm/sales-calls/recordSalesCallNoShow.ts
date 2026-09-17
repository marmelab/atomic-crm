import type { DataProvider, Identifier } from "ra-core";

import type { Contact, Deal, SalesCall, Tag, Task } from "../types";
import { completeResolveSalesCallTask } from "./resolveSalesCallTask";

// Gate B — the dev/FakeRest half of the dual-implementation No-show path.
// The production path is the Postgres function
// record_sales_call_no_show() (supabase/schemas/02_functions.sql), which
// applies all of this in ONE transaction. This module is the
// FakeRest-testable "logic of record" the function mirrors — the same
// dual-implementation pattern already used for public application intake
// (submit_public_application() <-> submitApplication.ts) and waitlist sync
// (deal_waitlist_sync trigger <-> waitlistSync.ts).
//
// The rule: marking a sales call No-show is certain enough to exit the
// Opportunity. Concretely —
//   Sales Call  canonical history: attendance 'no_show', status 'completed'
//   Opportunity leaves the ACTIVE pipeline via outcome 'lost'
//   Contact     carries a durable, visible "No-show" tag
//   Tasks       no new follow-up work is created
// Nothing is deleted, no stage is rewritten, and no new pipeline stage or
// outcome value is invented.

export const NO_SHOW_TAG_NAME = "No-show";
// Same palette the manual tag UI uses (tags/colors.ts).
const NO_SHOW_TAG_COLOR = "#fde2e4";

export type RecordSalesCallNoShowResult =
  | { status: "completed" }
  // Re-running the action on an already-no-showed call. Safe and
  // convergent: it re-asserts the exit and the tag rather than duplicating
  // anything.
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

  // 2. The Opportunity exits the ACTIVE pipeline. "Active" is canonically
  //    archived_at null AND stage !== 'won' AND outcome null (DealList's
  //    own filter), so setting outcome is the existing exit mechanism.
  //    'lost' is the same exit the Do-Not-Engage path uses; the no-show
  //    REASON stays durable on the Sales Call, so no reason column is
  //    invented. stage is deliberately left alone — the Deal really did
  //    reach Call Booked, and rewriting that to mark an exit would falsify
  //    history.
  const { data: deal } = await dataProvider.getOne<Deal>("deals", {
    id: salesCall.opportunity_id,
  });
  if (
    deal.outcome == null &&
    deal.archived_at == null &&
    deal.stage !== "won"
  ) {
    await dataProvider.update<Deal>("deals", {
      id: deal.id,
      data: { outcome: "lost" },
      previousData: deal,
    });
  }

  // 3. Contact-level visible history, reusing the existing tag model.
  await ensureNoShowTag(dataProvider, salesCall.contact_id);

  // 4. The call concluded, so its own task is done. No follow-up task is
  //    created: the Opportunity has left the pipeline, so there is no
  //    stranded decision to re-surface. A 'sales_call_no_show' task left
  //    pending by the previous behavior is superseded work, closed here
  //    rather than left behind as impossible work.
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
