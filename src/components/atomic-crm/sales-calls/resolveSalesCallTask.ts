import type { DataProvider, Identifier } from "ra-core";

import { formatTimestampWithTimeString } from "../deals/dealUtils";
import type { Task } from "../types";

const RESOLVE_SALES_CALL_TASK_TYPE = "resolve_sales_call";

// Surfaces a booking that couldn't be safely matched to exactly one active
// Opportunity (Acuity/Sales Call Lifecycle slice, Decision 3: "must not
// become an invisible database record"). Reuses the same Task
// infrastructure every other task type already gets — but as of the
// Unmatched Sales Call Resolution slice, a purpose-built page
// (/sales-calls/:id/resolve, routed via taskActionDestination.ts) resolves
// it, not the generic Task editor. Mirrors applications/
// reviewApplicationTask.ts's find/ensure/complete shape.
//
// Deterministic by sales_call_id when known (a returning Contact can have
// more than one unresolved booking at once — contact_id alone can't tell
// them apart). Falls back to the old contact_id+type search only for a
// legacy Task created before tasks.sales_call_id existed (migration
// 20260904240000 backfills every real one that was unambiguous at the
// time; this fallback is what still finds one that wasn't).
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

// The Task's own text is what the Dashboard/Contact page actually show
// (Task.tsx treats resolve_sales_call as self-describing — see its own
// SELF_DESCRIBING_TASK_TYPES comment) — "%{name} · %{offer} · %{when}" so
// a returning Contact's several unresolved bookings read as genuinely
// distinct rows, never identical ones needing a click to tell apart.
export const ensureResolveSalesCallTask = async (
  dataProvider: DataProvider,
  {
    contactId,
    contactName,
    salesCallId,
    scheduledAt,
    offerName,
    cohortName,
    salesId,
  }: {
    contactId: Identifier;
    contactName: string;
    salesCallId: Identifier;
    scheduledAt: string;
    offerName: string;
    cohortName?: string | null;
    salesId?: Identifier | null;
  },
): Promise<void> => {
  const existing = await findPendingResolveSalesCallTask(
    dataProvider,
    contactId,
    salesCallId,
  );
  if (existing) return;

  const offerLabel = cohortName ? `${offerName} — ${cohortName}` : offerName;
  await dataProvider.create("tasks", {
    data: {
      contact_id: contactId,
      type: RESOLVE_SALES_CALL_TASK_TYPE,
      text: `${contactName} · ${offerLabel} · ${formatTimestampWithTimeString(scheduledAt)}`,
      due_date: new Date().toISOString(),
      status: "pending",
      sales_call_id: salesCallId,
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
