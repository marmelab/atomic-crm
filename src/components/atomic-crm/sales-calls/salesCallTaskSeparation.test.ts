import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer, SalesCall, Task } from "../types";
import { bookSalesCall } from "./bookSalesCall";
import { attachSalesCallToOpportunity } from "./resolveUnmatchedSalesCall";
import { completeSalesCallOutcome } from "./completeSalesCallOutcome";
import { recordSalesCallNoShow } from "./recordSalesCallNoShow";
import { cancelSalesCall } from "./cancelSalesCall";
import { ensureResolveSalesCallTask } from "./resolveSalesCallTask";
import {
  RESOLVE_SALES_CALL_TASK_TYPE,
  SALES_CALL_NEEDS_MATCHING_TASK_TYPE,
  classifySalesCallAmbiguity,
} from "./salesCallTaskTypes";
import { classifyTaskActionKind } from "../tasks/taskActionDestination";
import { isDone } from "../tasks/tasksPredicate";

// Production acceptance found the Dashboard offering "SALES CALL NEEDS
// MATCHING — Megan Auron · call of Jul 7, 2026 — what happened?" and the
// page it opened replying "This booking is already attached to an
// Opportunity." Megan's call never needed matching; what was unknown was
// its outcome.
//
// These tests hold the two questions apart: which Opportunity does this
// booking belong to, and what happened on this call.
const CONTACT_ID = 1;
const OFFER_ID = 1;
const APPOINTMENT_TYPE_ID = "999888";

const offer: Offer = {
  id: OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "6 months",
  current_price: 4000,
  is_active: true,
  acuity_appointment_type_id: APPOINTMENT_TYPE_ID,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildDeal = (overrides: Partial<Deal> = {}): Deal =>
  ({
    pricing_mode: "standard",
    id: 10,
    name: "Ada Lovelace — The Living Example",
    contact_id: CONTACT_ID,
    offer_id: OFFER_ID,
    stage: "approved",
    outcome: null,
    owner_decision: null,
    amount: 4000,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    sales_id: 0,
    index: 0,
    stage_entered_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as Deal;

const buildSalesCall = (overrides: Partial<SalesCall> = {}): SalesCall =>
  ({
    id: 1,
    opportunity_id: null,
    contact_id: CONTACT_ID,
    status: "booked",
    original_scheduled_at: "2026-07-07T18:00:00.000Z",
    scheduled_at: "2026-07-07T18:00:00.000Z",
    scheduled_on: "2026-07-07",
    schedule_precision: "exact",
    reschedule_count: 0,
    attendance: null,
    source: "acuity",
    acuity_appointment_id: "acuity-1",
    acuity_appointment_type_id: APPOINTMENT_TYPE_ID,
    dismissed_at: null,
    dismissal_reason: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as SalesCall;

const makeProvider = ({
  salesCalls = [],
  deals = [],
  tasks = [],
}: {
  salesCalls?: SalesCall[];
  deals?: Deal[];
  tasks?: Task[];
} = {}) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({
          id: CONTACT_ID,
          first_name: "Ada",
          last_name: "Lovelace",
        }),
      ],
      offers: [offer],
      deals,
      sales_calls: salesCalls,
      tasks,
    }),
    silent: true,
  });

const pendingOfType = async (
  dataProvider: ReturnType<typeof makeProvider>,
  type: string,
): Promise<Task[]> => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    filter: { contact_id: CONTACT_ID, type },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "id", order: "ASC" },
  });
  // The app's own definition of open work: a cancelled task is not
  // pending either, and cancelSalesCall deliberately cancels without a
  // done_date ("a cancelled task was never done").
  return data.filter((task) => !isDone(task));
};

describe("sales call ambiguity — which question is open", () => {
  it("asks for matching when the booking has no Opportunity", () => {
    expect(
      classifySalesCallAmbiguity(buildSalesCall({ opportunity_id: null })),
    ).toBe("needs-matching");
  });

  it("asks what happened when the booking is attached and attendance was never recorded", () => {
    expect(
      classifySalesCallAmbiguity(
        buildSalesCall({ opportunity_id: 10, status: "completed" }),
        new Date("2026-09-17T12:00:00.000Z"),
      ),
    ).toBe("needs-outcome");
  });

  // Megan's exact production shape: the contradiction this whole change
  // exists to remove.
  it("never asks for matching about a call that is already attached", () => {
    expect(
      classifySalesCallAmbiguity(
        buildSalesCall({ opportunity_id: 10, status: "completed" }),
        new Date("2026-09-17T12:00:00.000Z"),
      ),
    ).not.toBe("needs-matching");
  });

  it("asks nothing about a call that has not happened yet", () => {
    expect(
      classifySalesCallAmbiguity(
        buildSalesCall({
          opportunity_id: 10,
          scheduled_at: "2026-10-13T18:00:00.000Z",
          scheduled_on: "2026-10-13",
        }),
        new Date("2026-09-17T12:00:00.000Z"),
      ),
    ).toBe("none");
  });

  it("asks nothing once attendance is recorded, or the call was cancelled or dismissed", () => {
    const at = new Date("2026-09-17T12:00:00.000Z");
    expect(
      classifySalesCallAmbiguity(
        buildSalesCall({ opportunity_id: 10, attendance: "attended" }),
        at,
      ),
    ).toBe("none");
    expect(
      classifySalesCallAmbiguity(
        buildSalesCall({ opportunity_id: 10, status: "cancelled" }),
        at,
      ),
    ).toBe("none");
    expect(
      classifySalesCallAmbiguity(
        buildSalesCall({
          opportunity_id: null,
          dismissed_at: "2026-08-01T00:00:00.000Z",
        }),
        at,
      ),
    ).toBe("none");
  });

  it("waits for a date-only call's whole day to pass before asking what happened", () => {
    const dateOnly = buildSalesCall({
      opportunity_id: 10,
      status: "completed",
      schedule_precision: "date_only",
      scheduled_at: null,
      original_scheduled_at: null,
      scheduled_on: "2026-09-17",
    });
    expect(
      classifySalesCallAmbiguity(dateOnly, new Date("2026-09-17T23:00:00")),
    ).toBe("none");
    expect(
      classifySalesCallAmbiguity(dateOnly, new Date("2026-09-18T00:30:00")),
    ).toBe("needs-outcome");
  });
});

describe("task label describes the action actually needed", () => {
  it("sends a matching task to the matching screen and an outcome task to the outcome screen", () => {
    expect(classifyTaskActionKind(SALES_CALL_NEEDS_MATCHING_TASK_TYPE)).toBe(
      "sales-call-needs-matching",
    );
    expect(classifyTaskActionKind(RESOLVE_SALES_CALL_TASK_TYPE)).toBe(
      "resolve-sales-call",
    );
  });

  it("writes an outcome task that asks what happened, naming the person and the date", async () => {
    const dataProvider = makeProvider({
      salesCalls: [buildSalesCall({ opportunity_id: 10, status: "completed" })],
      deals: [buildDeal({ stage: "call_booked" })],
    });
    await ensureResolveSalesCallTask(dataProvider, {
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      salesCall: buildSalesCall({ opportunity_id: 10 }),
    });

    const [task] = await pendingOfType(
      dataProvider,
      RESOLVE_SALES_CALL_TASK_TYPE,
    );
    expect(task.text).toContain("Ada Lovelace");
    expect(task.text).toContain("what happened?");
    expect(task.text).not.toContain("needs matching");
  });
});

describe("matching task lifecycle", () => {
  it("an unmatched booking produces a matching task, not an outcome task", async () => {
    const dataProvider = makeProvider();
    await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      opportunityId: null,
      scheduledAt: "2026-07-07T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-1",
      acuityAppointmentTypeId: APPOINTMENT_TYPE_ID,
      offerName: "The Living Example",
    });

    expect(
      await pendingOfType(dataProvider, SALES_CALL_NEEDS_MATCHING_TASK_TYPE),
    ).toHaveLength(1);
    expect(
      await pendingOfType(dataProvider, RESOLVE_SALES_CALL_TASK_TYPE),
    ).toHaveLength(0);
  });

  it("attaching an Opportunity removes the matching task", async () => {
    const dataProvider = makeProvider({ deals: [buildDeal()] });
    await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      opportunityId: null,
      scheduledAt: "2026-07-07T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-1",
      acuityAppointmentTypeId: APPOINTMENT_TYPE_ID,
      offerName: "The Living Example",
    });
    const [booking] = (
      await dataProvider.getList<SalesCall>("sales_calls", {
        filter: {},
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      })
    ).data;

    const result = await attachSalesCallToOpportunity(dataProvider, {
      salesCallId: booking.id,
      opportunityId: 10,
    });

    expect(result.applied).toBe(true);
    expect(
      await pendingOfType(dataProvider, SALES_CALL_NEEDS_MATCHING_TASK_TYPE),
    ).toHaveLength(0);
  });

  it("never leaves both a matching task and an outcome task open for the same call", async () => {
    const dataProvider = makeProvider({ deals: [buildDeal()] });
    await bookSalesCall({
      dataProvider,
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      opportunityId: null,
      scheduledAt: "2026-07-07T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-1",
      acuityAppointmentTypeId: APPOINTMENT_TYPE_ID,
      offerName: "The Living Example",
    });
    const [booking] = (
      await dataProvider.getList<SalesCall>("sales_calls", {
        filter: {},
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      })
    ).data;
    await attachSalesCallToOpportunity(dataProvider, {
      salesCallId: booking.id,
      opportunityId: 10,
    });
    await ensureResolveSalesCallTask(dataProvider, {
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      salesCall: booking,
    });
    // A second ensure for the same call is a no-op, never a duplicate row.
    await ensureResolveSalesCallTask(dataProvider, {
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      salesCall: booking,
    });

    expect(
      await pendingOfType(dataProvider, SALES_CALL_NEEDS_MATCHING_TASK_TYPE),
    ).toHaveLength(0);
    expect(
      await pendingOfType(dataProvider, RESOLVE_SALES_CALL_TASK_TYPE),
    ).toHaveLength(1);
  });
});

// The three canonical answers. Each one must resolve the ambiguity task,
// and none of them may be reachable by "marking attendance to clear a
// task" — they are the same actions the Opportunity's own Sales Call
// section uses, taking the same path through the pipeline.
describe("the three canonical outcomes each resolve the ambiguity", () => {
  const openOutcomeTask = async () => {
    const booking = buildSalesCall({
      opportunity_id: 10,
      status: "completed",
    });
    const dataProvider = makeProvider({
      salesCalls: [booking],
      deals: [buildDeal({ stage: "call_booked" })],
    });
    await ensureResolveSalesCallTask(dataProvider, {
      contactId: CONTACT_ID,
      contactName: "Ada Lovelace",
      salesCall: booking,
    });
    expect(
      await pendingOfType(dataProvider, RESOLVE_SALES_CALL_TASK_TYPE),
    ).toHaveLength(1);
    return { dataProvider, booking };
  };

  it("call happened resolves it", async () => {
    const { dataProvider, booking } = await openOutcomeTask();
    await completeSalesCallOutcome({
      dataProvider,
      salesCallId: booking.id,
      contactName: "Ada Lovelace",
      attendance: "attended",
      ownerDecision: "approved",
      prospectDecision: "thinking",
      followUpDate: "2026-09-24",
    });

    const call = (
      await dataProvider.getOne<SalesCall>("sales_calls", { id: booking.id })
    ).data;
    expect(call.attendance).toBe("attended");
    expect(classifySalesCallAmbiguity(call)).toBe("none");
    expect(
      await pendingOfType(dataProvider, RESOLVE_SALES_CALL_TASK_TYPE),
    ).toHaveLength(0);
  });

  it("no-show resolves it", async () => {
    const { dataProvider, booking } = await openOutcomeTask();
    await recordSalesCallNoShow(dataProvider, booking.id);

    const call = (
      await dataProvider.getOne<SalesCall>("sales_calls", { id: booking.id })
    ).data;
    expect(call.attendance).toBe("no_show");
    expect(classifySalesCallAmbiguity(call)).toBe("none");
    expect(
      await pendingOfType(dataProvider, RESOLVE_SALES_CALL_TASK_TYPE),
    ).toHaveLength(0);
  });

  it("cancelled resolves it", async () => {
    const { dataProvider, booking } = await openOutcomeTask();
    await cancelSalesCall(dataProvider, booking.id);

    const call = (
      await dataProvider.getOne<SalesCall>("sales_calls", { id: booking.id })
    ).data;
    expect(call.status).toBe("cancelled");
    expect(classifySalesCallAmbiguity(call)).toBe("none");
    expect(
      await pendingOfType(dataProvider, RESOLVE_SALES_CALL_TASK_TYPE),
    ).toHaveLength(0);
  });
});
