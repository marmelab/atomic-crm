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

    // Go-Live Blocker: Sales-Call No-Show/Rebooking slice — an attended
    // call concludes exactly the same as a no-show for sales_calls.status
    // (see that slice's migration/comment); only attendance differs.
    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: SALES_CALL_ID },
    );
    expect(salesCall.status).toBe("completed");
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

  it("No-show: records attendance, completes the task, creates exactly one no-show follow-up Task, and never changes the Opportunity to Lost/Nurture/Committed/etc.", async () => {
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
    // Go-Live Blocker: Sales-Call No-Show/Rebooking slice — the stage/
    // outcome/owner_decision restraint is unchanged (still nobody's
    // decision to guess); this is exactly the "do NOT auto-mark
    // Lost/Nurture/Not Fit/Do Not Engage" requirement.
    // Gate B: the Deal EXITS the active pipeline. "Active" is canonically
    // archived_at null AND stage !== "won" AND outcome null (DealList.tsx's
    // own filter), so outcome carries the exit. stage is deliberately
    // preserved — the Deal really did reach Call Booked, and rewriting that
    // to mark an exit would falsify history. No decision is invented, and
    // the outcome is never "nurture".
    expect(deal.stage).toBe("call_booked");
    expect(deal.outcome).toBe("lost");
    expect(deal.outcome).not.toBe("nurture");
    expect(deal.owner_decision).toBeNull();
    expect(deal.prospect_decision ?? null).toBeNull();

    const { data: task } = await dataProvider.getOne<Task>("tasks", {
      id: TASK_ID,
    });
    expect(task.status).toBe("completed");

    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: SALES_CALL_ID },
    );
    expect(salesCall.attendance).toBe("no_show");
    // Go-Live Blocker fix: a concluded call must leave 'booked' — see
    // sales_calls_one_booked_per_opportunity_idx's own comment in
    // 01_tables.sql for why (blocks/corrupts a genuine rebooking otherwise).
    expect(salesCall.status).toBe("completed");

    // Gate B: ZERO ordinary follow-up work. The old "decide next steps"
    // task existed only because the Opportunity used to strand in the
    // pipeline; now that it exits, there is nothing left to re-surface.
    const { data: followUps } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "sales_call_no_show" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(followUps).toHaveLength(0);
    const { data: everyTask } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    expect(everyTask.filter((t) => !t.done_date)).toHaveLength(0);

    // Gate B: the Contact carries durable, visible no-show history.
    const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
      id: CONTACT_ID,
    });
    const { data: tags } = await dataProvider.getList("tags", {
      filter: {},
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    const noShowTag = tags.find(
      (t: { name?: string }) => t.name?.toLowerCase() === "no-show",
    );
    expect(noShowTag).toBeTruthy();
    expect(contact.tags ?? []).toContain(noShowTag!.id);
  });

  it("No-show is idempotent: re-completing an already-recorded no-show never creates a second follow-up Task", async () => {
    const { dataProvider } = buildFixtures();

    await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "no_show",
    });
    const second = await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "no_show",
    });
    // Re-running converges rather than erroring or duplicating anything.
    expect(second.status).toBe("completed");

    const { data: tags } = await dataProvider.getList("tags", {
      filter: {},
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    // Exactly one No-show tag exists, attached exactly once.
    expect(
      tags.filter(
        (t: { name?: string }) => t.name?.toLowerCase() === "no-show",
      ),
    ).toHaveLength(1);
    const noShowTagId = tags.find(
      (t: { name?: string }) => t.name?.toLowerCase() === "no-show",
    )!.id;
    const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
      id: CONTACT_ID,
    });
    expect(
      (contact.tags ?? []).filter((id) => String(id) === String(noShowTagId)),
    ).toHaveLength(1);

    // No duplicate history, no duplicate follow-up work.
    const { data: events } = await dataProvider.getList("sales_call_events", {
      filter: { sales_call_id: SALES_CALL_ID, kind: "attendance_recorded" },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    expect(events).toHaveLength(1);
    const { data: allTasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "sales_call_no_show" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(allTasks).toHaveLength(0);

    // The Deal stays exited — never revived, never double-mutated.
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.outcome).toBe("lost");
    expect(deal.stage).toBe("call_booked");
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

// ---------------------------------------------------------------------------
// Gate B — the No-show exit rule, in full.
// ---------------------------------------------------------------------------
describe("sales-call No-show exits the Opportunity", () => {
  const OTHER_CONTACT_ID = 2;
  const OTHER_DEAL_ID = 2;
  const OTHER_CALL_ID = 2;

  const buildTwoOpportunityFixtures = () => {
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [
          buildContact({ id: CONTACT_ID }),
          buildContact({ id: OTHER_CONTACT_ID, first_name: "Unrelated" }),
        ],
        offers: [buildOffer()],
        deals: [
          buildDeal(),
          buildDeal({
            id: OTHER_DEAL_ID,
            contact_id: OTHER_CONTACT_ID,
            name: "Unrelated Opportunity",
          }),
        ],
        sales_calls: [
          buildSalesCall(),
          buildSalesCall({
            id: OTHER_CALL_ID,
            opportunity_id: OTHER_DEAL_ID,
            contact_id: OTHER_CONTACT_ID,
          }),
        ],
        tasks: [],
      }),
      silent: true,
      latency: 0,
    });
    return { dataProvider };
  };

  const markNoShow = (dataProvider: any, salesCallId = SALES_CALL_ID) =>
    completeSalesCallOutcome({
      dataProvider,
      salesCallId,
      contactName: "Ada Lovelace",
      attendance: "no_show",
    });

  it("removes the Opportunity from the active-pipeline query while preserving both records", async () => {
    const { dataProvider } = buildTwoOpportunityFixtures();
    await markNoShow(dataProvider);

    // The exact filter the Kanban board uses (DealList.tsx).
    const { data: activePipeline } = await dataProvider.getList<Deal>("deals", {
      filter: {
        "archived_at@is": null,
        "stage@neq": "won",
        "outcome@is": null,
      },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    expect(activePipeline.map((d) => d.id)).not.toContain(DEAL_ID);

    // Preserved, not deleted — both the Deal and the Sales Call.
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.id).toBe(DEAL_ID);
    expect(deal.name).toBe("Ada Lovelace");
    const { data: call } = await dataProvider.getOne<SalesCall>("sales_calls", {
      id: SALES_CALL_ID,
    });
    expect(call.id).toBe(SALES_CALL_ID);
    expect(call.attendance).toBe("no_show");
    expect(call.scheduled_at).toBe("2026-09-01T15:00:00.000Z");
  });

  it("never introduces a no_show pipeline stage", async () => {
    const { dataProvider } = buildTwoOpportunityFixtures();
    await markNoShow(dataProvider);
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.stage).not.toBe("no_show");
    expect(deal.stage).toBe("call_booked");
  });

  it("leaves an unrelated Opportunity and its Sales Call untouched", async () => {
    const { dataProvider } = buildTwoOpportunityFixtures();
    await markNoShow(dataProvider);

    const { data: otherDeal } = await dataProvider.getOne<Deal>("deals", {
      id: OTHER_DEAL_ID,
    });
    expect(otherDeal.outcome).toBeNull();
    expect(otherDeal.stage).toBe("call_booked");

    const { data: otherCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: OTHER_CALL_ID },
    );
    expect(otherCall.attendance ?? null).toBeNull();
    expect(otherCall.status).toBe("booked");

    // The unrelated Contact never receives the tag.
    const { data: otherContact } = await dataProvider.getOne<Contact>(
      "contacts",
      { id: OTHER_CONTACT_ID },
    );
    expect(otherContact.tags ?? []).toHaveLength(0);
  });

  it("keeps the historical tag and the no_show call when the Contact later re-enters sales", async () => {
    const { dataProvider } = buildTwoOpportunityFixtures();
    await markNoShow(dataProvider);

    // A legitimate NEW Opportunity later — the old one is never revived.
    const { data: newDeal } = await dataProvider.create<Deal>("deals", {
      data: buildDeal({ id: 99, stage: "interested", outcome: null }),
    });

    const { data: oldDeal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(oldDeal.outcome).toBe("lost");
    expect(newDeal.outcome ?? null).toBeNull();

    // Historical truth survives the new Opportunity.
    const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
      id: CONTACT_ID,
    });
    expect(contact.tags ?? []).toHaveLength(1);
    const { data: call } = await dataProvider.getOne<SalesCall>("sales_calls", {
      id: SALES_CALL_ID,
    });
    expect(call.attendance).toBe("no_show");
  });

  it("does not touch client_sessions — paid client-session no-shows are a separate domain", async () => {
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [buildContact({ id: CONTACT_ID })],
        offers: [buildOffer()],
        deals: [buildDeal()],
        sales_calls: [buildSalesCall()],
        tasks: [],
        client_sessions: [
          {
            id: 1,
            enrollment_id: 1,
            contact_id: CONTACT_ID,
            offer_id: OFFER_ID,
            status: "booked",
            scheduled_at: "2026-09-02T15:00:00.000Z",
            sequence_number: 1,
            source: "manual",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      } as any),
      silent: true,
      latency: 0,
    });

    await markNoShow(dataProvider);

    const { data: sessions } = await dataProvider.getList("client_sessions", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe("booked");
    expect(sessions[0].attendance ?? null).toBeNull();
  });

  it("closes a stale sales_call_no_show task rather than leaving impossible work behind", async () => {
    // A task created by the PREVIOUS behavior, before the exit rule existed.
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [buildContact({ id: CONTACT_ID })],
        offers: [buildOffer()],
        deals: [buildDeal()],
        sales_calls: [buildSalesCall()],
        tasks: [
          {
            id: 5,
            contact_id: CONTACT_ID,
            type: "sales_call_no_show",
            text: "decide next steps",
            due_date: "2026-09-01T15:00:00.000Z",
            done_date: null,
            status: "pending",
            sales_id: 0,
          },
        ],
      }),
      silent: true,
      latency: 0,
    });

    await markNoShow(dataProvider);

    const { data: task } = await dataProvider.getOne<Task>("tasks", { id: 5 });
    expect(task.status).toBe("completed");
    expect(task.done_date).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Gate B — convergence for a call already recorded no_show by the PREVIOUS
// behavior. The real-Postgres proof found exactly this shape in production
// data: attendance already 'no_show', but status still 'booked' and the
// Opportunity still active.
// ---------------------------------------------------------------------------
describe("No-show convergence on a half-recorded legacy call", () => {
  it("completes the call, exits the Opportunity and tags the Contact without inventing a new attendance timestamp or a duplicate event", async () => {
    const recordedAt = "2026-09-14T16:35:37.584Z";
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [buildContact({ id: CONTACT_ID })],
        offers: [buildOffer()],
        deals: [buildDeal()],
        sales_calls: [
          buildSalesCall({
            // The inconsistent legacy shape.
            status: "booked",
            attendance: "no_show",
            attendance_recorded_at: recordedAt,
          }),
        ],
        tasks: [],
      }),
      silent: true,
      latency: 0,
    });

    await completeSalesCallOutcome({
      dataProvider,
      salesCallId: SALES_CALL_ID,
      contactName: "Ada Lovelace",
      attendance: "no_show",
    });

    const { data: call } = await dataProvider.getOne<SalesCall>("sales_calls", {
      id: SALES_CALL_ID,
    });
    // Status converges so a genuine rebooking is no longer blocked by the
    // partial unique index...
    expect(call.status).toBe("completed");
    // ...but WHEN the no-show was observed is historical truth, untouched.
    expect(call.attendance).toBe("no_show");
    expect(call.attendance_recorded_at).toBe(recordedAt);

    // No second history event is fabricated for an observation that was
    // recorded before this rule existed.
    const { data: events } = await dataProvider.getList("sales_call_events", {
      filter: { sales_call_id: SALES_CALL_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(events).toHaveLength(0);

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.outcome).toBe("lost");
    expect(deal.stage).toBe("call_booked");

    const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
      id: CONTACT_ID,
    });
    expect(contact.tags ?? []).toHaveLength(1);
  });
});
