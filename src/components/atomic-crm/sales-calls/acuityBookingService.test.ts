import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer, SalesCall, Task } from "../types";
import { processAcuityWebhookEvent } from "./acuityBookingService";

const CONTACT_ID = 1;
const OFFER_ID = 1;
const DEAL_ID = 1;

const buildOffer = (): Offer => ({
  id: OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "6 months",
  current_price: 4000,
  is_active: true,
  acuity_appointment_type_id: "le-type",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  pricing_mode: "standard",
  id: DEAL_ID,
  name: "Ada Lovelace",
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
});

const buildFixtures = (dealOverrides: Partial<Deal> = {}) => {
  const contact = buildContact({ id: CONTACT_ID });
  const offer = buildOffer();
  const deal = buildDeal(dealOverrides);
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [contact],
      offers: [offer],
      cohorts: [],
      deals: [deal],
      tasks: [],
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider, deal, contact };
};

describe("processAcuityWebhookEvent", () => {
  it("scheduled: books the matched Opportunity's call and advances the pipeline", async () => {
    const { dataProvider } = buildFixtures();

    const outcome = await processAcuityWebhookEvent({
      dataProvider,
      action: "scheduled",
      appointment: {
        acuityAppointmentId: "acuity-2",
        acuityAppointmentTypeId: "le-type",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-10T15:00:00.000Z",
      },
    });
    expect(outcome.status).toBe("booked");
    if (outcome.status === "booked") {
      expect(outcome.matchReason).toBe("matched");
    }

    const { data: updatedDeal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(updatedDeal.stage).toBe("call_booked");
  });

  it("a duplicate webhook delivery for the same appointment never creates a second Contact, Task, or Sales Call", async () => {
    const { dataProvider } = buildFixtures();
    const appointment = {
      acuityAppointmentId: "acuity-dup",
      acuityAppointmentTypeId: "le-type",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      datetime: "2026-09-10T15:00:00.000Z",
    };

    await processAcuityWebhookEvent({
      dataProvider,
      action: "scheduled",
      appointment,
    });
    await processAcuityWebhookEvent({
      dataProvider,
      action: "scheduled",
      appointment,
    });

    const { total: contactCount } = await dataProvider.getList("contacts", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(contactCount).toBe(1);

    const { total: salesCallCount } = await dataProvider.getList(
      "sales_calls",
      {
        filter: { acuity_appointment_id: "acuity-dup" },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(salesCallCount).toBe(1);

    const { total: taskCount } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "sales_call" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(taskCount).toBe(1);
  });

  it("rescheduled: updates the same Sales Call row, never creating a second one, and moves the Task due date", async () => {
    const { dataProvider, deal } = buildFixtures();
    await processAcuityWebhookEvent({
      dataProvider,
      action: "scheduled",
      appointment: {
        acuityAppointmentId: "acuity-r1",
        acuityAppointmentTypeId: "le-type",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-10T15:00:00.000Z",
      },
    });

    const rescheduled = await processAcuityWebhookEvent({
      dataProvider,
      action: "rescheduled",
      appointment: {
        acuityAppointmentId: "acuity-r1",
        acuityAppointmentTypeId: "le-type",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-15T15:00:00.000Z",
      },
    });
    expect(rescheduled.status).toBe("rescheduled");

    const { total } = await dataProvider.getList("sales_calls", {
      filter: { opportunity_id: deal.id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);

    const { data: updatedDeal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(updatedDeal.sales_call_at).toBe("2026-09-15T15:00:00.000Z");

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "sales_call" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks[0].due_date).toBe("2026-09-15T15:00:00.000Z");
  });

  it("rescheduled multiple times: reschedule_count reflects every event and the individual events are preserved", async () => {
    const { dataProvider } = buildFixtures();
    const appointmentBase = {
      acuityAppointmentId: "acuity-multi",
      acuityAppointmentTypeId: "le-type",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    };
    await processAcuityWebhookEvent({
      dataProvider,
      action: "scheduled",
      appointment: { ...appointmentBase, datetime: "2026-09-10T15:00:00.000Z" },
    });
    await processAcuityWebhookEvent({
      dataProvider,
      action: "rescheduled",
      appointment: { ...appointmentBase, datetime: "2026-09-12T15:00:00.000Z" },
    });
    await processAcuityWebhookEvent({
      dataProvider,
      action: "rescheduled",
      appointment: { ...appointmentBase, datetime: "2026-09-20T15:00:00.000Z" },
    });

    const { data: calls } = await dataProvider.getList<SalesCall>(
      "sales_calls",
      {
        filter: { acuity_appointment_id: "acuity-multi" },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].reschedule_count).toBe(2);
    expect(calls[0].original_scheduled_at).toBe("2026-09-10T15:00:00.000Z");
    expect(calls[0].scheduled_at).toBe("2026-09-20T15:00:00.000Z");

    const { data: events } = await dataProvider.getList("sales_call_events", {
      filter: { sales_call_id: calls[0].id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(events.map((event) => event.kind)).toEqual([
      "booked",
      "rescheduled",
      "rescheduled",
    ]);
  });

  it("canceled: marks the call cancelled and cancels the pending task, without touching Opportunity stage", async () => {
    const { dataProvider, deal } = buildFixtures();
    await processAcuityWebhookEvent({
      dataProvider,
      action: "scheduled",
      appointment: {
        acuityAppointmentId: "acuity-c1",
        acuityAppointmentTypeId: "le-type",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-10T15:00:00.000Z",
      },
    });

    const cancelled = await processAcuityWebhookEvent({
      dataProvider,
      action: "canceled",
      appointment: {
        acuityAppointmentId: "acuity-c1",
        acuityAppointmentTypeId: "le-type",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-10T15:00:00.000Z",
      },
    });
    expect(cancelled.status).toBe("cancelled");

    const { data: updatedDeal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(updatedDeal.stage).toBe("call_booked");
    expect(updatedDeal.sales_call_at).toBeNull();

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "sales_call" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks[0].status).toBe("cancelled");

    void deal;
  });

  it("canceled for an appointment id this CRM never recorded is a safe no-op", async () => {
    const { dataProvider } = buildFixtures();
    const result = await processAcuityWebhookEvent({
      dataProvider,
      action: "canceled",
      appointment: {
        acuityAppointmentId: "never-seen",
        acuityAppointmentTypeId: "le-type",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-10T15:00:00.000Z",
      },
    });
    expect(result.status).toBe("unknown-appointment");
  });

  it("preserves an unmatched booking (ambiguous active Opportunities) rather than guessing", async () => {
    const contact = buildContact({ id: CONTACT_ID });
    const offer = buildOffer();
    const dealA = buildDeal({ id: 1 });
    const dealB = buildDeal({ id: 2 });
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [contact],
        offers: [offer],
        cohorts: [],
        deals: [dealA, dealB],
        tasks: [],
      }),
      silent: true,
      latency: 0,
    });

    const result = await processAcuityWebhookEvent({
      dataProvider,
      action: "scheduled",
      appointment: {
        acuityAppointmentId: "acuity-ambiguous",
        acuityAppointmentTypeId: "le-type",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-10T15:00:00.000Z",
      },
    });
    expect(result.status).toBe("booked");
    if (result.status === "booked") {
      expect(result.matchReason).toBe("ambiguous");
      expect(
        result.booking.status === "booked" &&
          result.booking.salesCall.opportunity_id,
      ).toBeFalsy();
    }

    const { data: resolveTasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "resolve_sales_call" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(resolveTasks).toHaveLength(1);
  });

  it("does not fabricate a match for a wrong/unmapped Offer/Cohort appointment type", async () => {
    const { dataProvider } = buildFixtures();
    const result = await processAcuityWebhookEvent({
      dataProvider,
      action: "scheduled",
      appointment: {
        acuityAppointmentId: "acuity-wrong-type",
        acuityAppointmentTypeId: "not-mapped-to-anything",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-10T15:00:00.000Z",
      },
    });
    expect(result.status).toBe("unknown-appointment-type");

    const { total } = await dataProvider.getList("sales_calls", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(0);
  });
});
