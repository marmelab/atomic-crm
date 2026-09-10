import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Deal, Enrollment, Offer, SalesCall, Task } from "../types";
import { processClientSessionAcuityEvent } from "./processClientSessionAcuityEvent";

const leOffer: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  is_active: true,
  // The SALES CALL mapping — a completely different appointment type than
  // the paid-client-session one below. Present here specifically to prove
  // this event never touches sales-call logic even though the SAME Offer
  // has both mappings configured, exactly like the real LE offer does.
  acuity_appointment_type_id: "91345095",
  client_session_acuity_appointment_type_id: "90522599",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  pricing_mode: "standard",
  id: 10,
  name: "Ada Lovelace",
  contact_id: 1,
  offer_id: 1,
  stage: "won",
  outcome: null,
  amount: 4000,
  sales_id: 0,
  index: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildEnrollment = (overrides: Partial<Enrollment> = {}): Enrollment => ({
  id: 100,
  opportunity_id: 10,
  status: "active",
  start_date: "2026-01-01",
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildProvider = ({
  deals = [],
  enrollments = [],
  tasks = [],
  salesCalls = [],
}: {
  deals?: Deal[];
  enrollments?: Enrollment[];
  tasks?: Task[];
  salesCalls?: SalesCall[];
}) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      offers: [leOffer],
      cohorts: [],
      deals,
      enrollments,
      tasks,
      sales_calls: salesCalls,
      sales_call_events: [],
      client_sessions: [],
      client_session_events: [],
    } as any),
    silent: true,
  });

describe("processClientSessionAcuityEvent", () => {
  it("routes appointment type 90522599 to client-session logic, matching the one legitimate active Enrollment silently", async () => {
    const dataProvider = buildProvider({
      deals: [buildDeal()],
      enrollments: [buildEnrollment()],
    });
    const result = await processClientSessionAcuityEvent(
      dataProvider,
      "scheduled",
      {
        acuityAppointmentId: "acuity-1",
        acuityAppointmentTypeId: "90522599",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-10T18:00:00.000Z",
      },
    );
    expect(result.status).toBe("booked");
    if (result.status !== "booked") return;
    expect(result.matchReason).toBe("matched");
    expect(result.booking.status).toBe("booked");
  });

  it("never creates a sales_calls row or a resolve_sales_call Task for a paid-client-session booking, even though the SAME Offer also has a sales-call mapping configured", async () => {
    const dataProvider = buildProvider({
      deals: [buildDeal()],
      enrollments: [buildEnrollment()],
    });
    await processClientSessionAcuityEvent(dataProvider, "scheduled", {
      acuityAppointmentId: "acuity-2",
      acuityAppointmentTypeId: "90522599",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      datetime: "2026-09-10T18:00:00.000Z",
    });

    const { total: salesCallCount } = await dataProvider.getList(
      "sales_calls",
      {
        filter: {},
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(salesCallCount).toBe(0);

    const { total: resolveTaskCount } = await dataProvider.getList("tasks", {
      filter: { type: "resolve_sales_call" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(resolveTaskCount).toBe(0);
  });

  it("preserves an unresolved session when zero legitimate Enrollments exist, never manufacturing an Opportunity/Enrollment", async () => {
    const dataProvider = buildProvider({ deals: [], enrollments: [] });
    const result = await processClientSessionAcuityEvent(
      dataProvider,
      "scheduled",
      {
        acuityAppointmentId: "acuity-3",
        acuityAppointmentTypeId: "90522599",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-10T18:00:00.000Z",
      },
    );
    expect(result.status).toBe("booked");
    if (result.status !== "booked") return;
    expect(result.matchReason).toBe("none");

    const { total: dealCount } = await dataProvider.getList("deals", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(dealCount).toBe(0);
    const { total: enrollmentCount } = await dataProvider.getList(
      "enrollments",
      {
        filter: {},
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(enrollmentCount).toBe(0);
  });

  it("preserves an unresolved session when 2+ Enrollments could legitimately match, never guessing", async () => {
    const dataProvider = buildProvider({
      deals: [buildDeal({ id: 10 }), buildDeal({ id: 11 })],
      enrollments: [
        buildEnrollment({ id: 100, opportunity_id: 10 }),
        buildEnrollment({ id: 101, opportunity_id: 11 }),
      ],
    });
    const result = await processClientSessionAcuityEvent(
      dataProvider,
      "scheduled",
      {
        acuityAppointmentId: "acuity-4",
        acuityAppointmentTypeId: "90522599",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-10T18:00:00.000Z",
      },
    );
    expect(result.status).toBe("booked");
    if (result.status !== "booked") return;
    expect(result.matchReason).toBe("ambiguous");
  });

  it("returns unknown-appointment-type for an appointment type mapped to nothing", async () => {
    const dataProvider = buildProvider({});
    const result = await processClientSessionAcuityEvent(
      dataProvider,
      "scheduled",
      {
        acuityAppointmentId: "acuity-5",
        acuityAppointmentTypeId: "999999",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-10T18:00:00.000Z",
      },
    );
    expect(result.status).toBe("unknown-appointment-type");
  });

  it("a sales-call appointment type (91345095) is never touched by this dispatcher at all (still unknown here — sales-call routing is a completely separate top-level function)", async () => {
    const dataProvider = buildProvider({});
    const result = await processClientSessionAcuityEvent(
      dataProvider,
      "scheduled",
      {
        acuityAppointmentId: "acuity-6",
        acuityAppointmentTypeId: "91345095",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        datetime: "2026-09-10T18:00:00.000Z",
      },
    );
    expect(result.status).toBe("unknown-appointment-type");
  });
});
