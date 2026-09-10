import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Contact, Deal, Offer, SalesCall, Task } from "../types";
import { completeSalesCallOutcome } from "./completeSalesCallOutcome";

const CONTACT_ID = 1;
const OFFER_ID = 1;
const DEAL_ID = 1;
const SALES_CALL_ID = 1;
const TASK_ID = 1;

const buildOffer = (): Offer => ({
  id: OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "6 months",
  current_price: 4000,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  pricing_mode: "standard",
  id: DEAL_ID,
  name: "Ada Lovelace",
  contact_id: CONTACT_ID,
  offer_id: OFFER_ID,
  stage: "call_booked",
  outcome: null,
  owner_decision: null,
  amount: 4000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildSalesCall = (overrides: Partial<SalesCall> = {}): SalesCall => ({
  id: SALES_CALL_ID,
  opportunity_id: DEAL_ID,
  contact_id: CONTACT_ID,
  status: "booked",
  original_scheduled_at: "2026-09-01T15:00:00.000Z",
  scheduled_at: "2026-09-01T15:00:00.000Z",
  reschedule_count: 0,
  source: "manual",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = ({
  dealOverrides = {},
  salesCallOverrides = {},
}: {
  dealOverrides?: Partial<Deal>;
  salesCallOverrides?: Partial<SalesCall>;
} = {}) => {
  const contact = buildContact({ id: CONTACT_ID });
  const deal = buildDeal(dealOverrides);
  const salesCall = buildSalesCall(salesCallOverrides);
  const task: Task = {
    id: TASK_ID,
    contact_id: CONTACT_ID,
    type: "sales_call",
    text: "Sales call with Ada Lovelace",
    due_date: salesCall.scheduled_at,
    done_date: null,
    status: "pending",
    sales_id: 0,
  };
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [contact],
      offers: [buildOffer()],
      deals: [deal],
      sales_calls: [salesCall],
      tasks: [task],
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider, deal, salesCall };
};

describe("completeSalesCallOutcome", () => {
  it("Attended + Would Work With + Yes: Opportunity progresses to Committed, the Sales Call task completes, no Follow-up task is created, and an Offer Page token is generated", async () => {
    const { dataProvider } = buildFixtures();

    const result = await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "attended",
      ownerDecision: "would_work_with",
      prospectDecision: "yes",
    });
    expect(result.status).toBe("completed");

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.stage).toBe("committed");
    expect(deal.owner_decision).toBe("would_work_with");
    expect(deal.prospect_decision).toBe("yes");
    expect(deal.outcome).toBeNull();
    // Payment domain foundation slice: reaching Committed generates the
    // personalized Offer Page's own opaque access token.
    expect(deal.offer_page_token).toBeTruthy();

    const { data: task } = await dataProvider.getOne<Task>("tasks", {
      id: TASK_ID,
    });
    expect(task.status).toBe("completed");
    expect(task.done_date).not.toBeNull();

    const { total: followUpCount } = await dataProvider.getList("tasks", {
      filter: { contact_id: CONTACT_ID, type: "follow_up" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(followUpCount).toBe(0);
  });

  it("Attended + Would Work With + Thinking (default): defaults the follow-up to +4 days and moves the Opportunity to Decision", async () => {
    const { dataProvider } = buildFixtures();

    await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "attended",
      ownerDecision: "would_work_with",
      prospectDecision: "thinking",
    });

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.stage).toBe("decision");
    expect(deal.prospect_decision).toBe("thinking");
    expect(deal.follow_up_date).not.toBeNull();
    // Only Committed generates an Offer Page token — Decision does not.
    expect(deal.offer_page_token).toBeFalsy();

    const { data: followUps } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "follow_up" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(followUps).toHaveLength(1);
    // The Task's due_date is a real timestamptz, not the bare
    // "YYYY-MM-DD" deals.follow_up_date is — Task.tsx always renders
    // due_date via formatTimestampString, which (per its own header)
    // assumes a genuine time component; storing the bare date directly
    // would display as the wrong calendar day for any viewer west of UTC
    // (regression-tested live in the browser during this slice's
    // adversarial pass — see followUpTask.ts's own header). Assert it's a
    // real timestamp built from the same calendar date, at local noon.
    expect(followUps[0].due_date).not.toBe(deal.follow_up_date);
    const [y, m, d] = deal.follow_up_date!.split("-").map(Number);
    expect(followUps[0].due_date).toBe(
      new Date(y!, m! - 1, d!, 12, 0, 0).toISOString(),
    );
  });

  it("Attended + Would Work With + Thinking (custom date): honors the user-provided follow-up date", async () => {
    const { dataProvider } = buildFixtures();

    await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "attended",
      ownerDecision: "would_work_with",
      prospectDecision: "thinking",
      followUpDate: "2026-12-25",
    });

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.follow_up_date).toBe("2026-12-25");

    const { data: followUps } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "follow_up" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(followUps[0].due_date).toBe(
      new Date(2026, 11, 25, 12, 0, 0).toISOString(),
    );
  });

  it("Attended + Would Work With + No: exits via the existing loss model, distinct from Workshops Only", async () => {
    const { dataProvider } = buildFixtures();

    await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "attended",
      ownerDecision: "would_work_with",
      prospectDecision: "no",
    });

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.outcome).toBe("lost");
    expect(deal.owner_decision).toBe("would_work_with");
    expect(deal.prospect_decision).toBe("no");
  });

  it("Attended + Workshops Only: exits the pipeline but is explicitly NOT 'lost'", async () => {
    const { dataProvider } = buildFixtures();

    await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "attended",
      ownerDecision: "workshops_only",
    });

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.outcome).toBe("workshops_only");
    expect(deal.outcome).not.toBe("lost");
    expect(deal.owner_decision).toBe("workshops_only");

    const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
      id: CONTACT_ID,
    });
    expect(contact.sales_eligibility).toBe("normal");
  });

  it("Attended + Do Not Engage: reuses the existing DNE logic, preserves history, never erases the Contact", async () => {
    const { dataProvider } = buildFixtures();

    await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "attended",
      ownerDecision: "do_not_engage",
    });

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.outcome).toBe("lost");
    expect(deal.owner_decision).toBe("do_not_engage");

    const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
      id: CONTACT_ID,
    });
    expect(contact.sales_eligibility).toBe("do_not_engage");
    expect(contact.first_name).toBeTruthy();

    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: SALES_CALL_ID },
    );
    expect(salesCall.attendance).toBe("attended");
  });

  it("No-show: records attendance and completes the task, without touching owner/prospect decision or stage", async () => {
    const { dataProvider } = buildFixtures();

    const result = await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "no_show",
    });
    expect(result.status).toBe("completed");

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.stage).toBe("call_booked");
    expect(deal.owner_decision).toBeNull();
    expect(deal.outcome).toBeNull();

    const { data: task } = await dataProvider.getOne<Task>("tasks", {
      id: TASK_ID,
    });
    expect(task.status).toBe("completed");

    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: SALES_CALL_ID },
    );
    expect(salesCall.attendance).toBe("no_show");
  });

  it("is idempotent: completing an already-completed call is a safe no-op, never a second write", async () => {
    const { dataProvider } = buildFixtures();

    await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "attended",
      ownerDecision: "would_work_with",
      prospectDecision: "yes",
    });
    const second = await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "attended",
      ownerDecision: "would_work_with",
      prospectDecision: "no",
    });
    expect(second.status).toBe("already-completed");

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    // Still reflects the FIRST (real) outcome, not the second call's data.
    expect(deal.prospect_decision).toBe("yes");
    expect(deal.stage).toBe("committed");
  });

  it("refuses to complete a call with no matched Opportunity", async () => {
    const { dataProvider } = buildFixtures({
      salesCallOverrides: { opportunity_id: null },
    });

    const result = await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "attended",
      ownerDecision: "would_work_with",
      prospectDecision: "yes",
    });
    expect(result.status).toBe("no-opportunity");
  });

  it("requires an owner-fit decision for an attended call", async () => {
    const { dataProvider } = buildFixtures();

    const result = await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "attended",
    });
    expect(result.status).toBe("validation-error");
  });
});
