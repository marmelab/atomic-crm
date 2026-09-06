// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory fake covering exactly the query-builder surface these
// handlers use (select/eq/limit/maybeSingle/insert/update/single) — a
// FakeRest-style stand-in for supabaseAdmin, the same spirit as this
// codebase's own providers/fakerest/dataProvider.ts, scoped to this one
// test file rather than a shared abstraction (Live Acuity Connection
// slice is a small adapter, not a framework).
type Row = Record<string, unknown>;

function createFakeDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = Object.fromEntries(
    Object.entries(seed).map(([name, rows]) => [
      name,
      rows.map((r) => ({ ...r })),
    ]),
  );
  let nextId = 1000;

  const matches = (row: Row, filters: [string, unknown][]) =>
    filters.every(([field, value]) => row[field] === value);

  const from = (table: string) => {
    tables[table] ??= [];
    const filters: [string, unknown][] = [];

    const builder = {
      eq(field: string, value: unknown) {
        filters.push([field, value]);
        return builder;
      },
      limit(_n: number) {
        return Promise.resolve({
          data: tables[table].filter((r) => matches(r, filters)),
          error: null,
        });
      },
      maybeSingle() {
        const found = tables[table].find((r) => matches(r, filters));
        return Promise.resolve({ data: found ?? null, error: null });
      },
      select(_cols?: string) {
        return builder;
      },
      insert(row: Row) {
        const created = { id: nextId++, ...row };
        tables[table].push(created);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: created, error: null }),
          }),
        };
      },
      update(patch: Row) {
        return {
          eq(field: string, value: unknown) {
            tables[table] = tables[table].map((r) =>
              r[field] === value ? { ...r, ...patch } : r,
            );
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
      // Default awaited result for a bare `.select()` with only `.eq()`
      // chained (findOrCreateContact's unfiltered select, and
      // findActiveOpportunity's eq-chain in acuityMatching.ts).
      then(resolve: (v: unknown) => void) {
        resolve({
          data: tables[table].filter((r) => matches(r, filters)),
          error: null,
        });
      },
    };
    return builder;
  };

  return { from, tables };
}

const fakeDb = vi.hoisted(() => ({
  current: null as ReturnType<typeof createFakeDb> | null,
}));

vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (table: string) => fakeDb.current!.from(table),
  },
}));

import {
  handleCanceled,
  handleRescheduled,
  handleScheduled,
} from "./acuitySalesCallHandlers";
import type { AcuityAppointmentDetails } from "./acuityApi";

const APPOINTMENT_TYPE_ID = "111";
const buildAppointment = (
  overrides: Partial<AcuityAppointmentDetails> = {},
): AcuityAppointmentDetails => ({
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  datetime: "2026-09-10T18:00:00.000Z",
  appointmentTypeID: Number(APPOINTMENT_TYPE_ID),
  ...overrides,
});

const seedWith = (overrides: Partial<Record<string, Row[]>> = {}) =>
  createFakeDb({
    offers: [
      {
        id: 1,
        name: "The Living Example",
        type: "individual",
        acuity_appointment_type_id: APPOINTMENT_TYPE_ID,
      },
    ],
    cohorts: [],
    contacts: [],
    deals: [],
    sales_calls: [],
    sales_call_events: [],
    tasks: [],
    sales: [{ id: 1, administrator: true }],
    ...overrides,
  });

async function json(response: Response) {
  return response.json();
}

describe("acuitySalesCallHandlers", () => {
  beforeEach(() => {
    fakeDb.current = seedWith();
  });
  afterAll(() => {
    vi.resetAllMocks();
  });

  describe("handleScheduled", () => {
    it("books a matched Opportunity: advances Approved -> Call Booked and creates a Sales Call task", async () => {
      fakeDb.current = seedWith({
        contacts: [
          {
            id: 1,
            first_name: "Ada",
            last_name: "Lovelace",
            email_jsonb: [{ email: "ada@example.com", type: "Home" }],
          },
        ],
        deals: [
          {
            id: 1,
            contact_id: 1,
            offer_id: 1,
            cohort_id: null,
            stage: "approved",
            outcome: null,
            archived_at: null,
          },
        ],
      });

      const response = await handleScheduled(buildAppointment(), "acuity-1");
      const body = await json(response);

      expect(body).toEqual({ status: "booked", matchReason: "matched" });
      expect(fakeDb.current.tables.sales_calls).toHaveLength(1);
      expect(fakeDb.current.tables.sales_calls[0]).toMatchObject({
        opportunity_id: 1,
        status: "booked",
        acuity_appointment_id: "acuity-1",
      });
      expect(fakeDb.current.tables.sales_call_events).toHaveLength(1);
      expect(fakeDb.current.tables.sales_call_events[0]).toMatchObject({
        kind: "booked",
      });
      expect(fakeDb.current.tables.deals[0].stage).toBe("call_booked");
      expect(fakeDb.current.tables.tasks).toHaveLength(1);
      expect(fakeDb.current.tables.tasks[0]).toMatchObject({
        type: "sales_call",
        contact_id: 1,
      });
    });

    it("preserves an unmatched booking (no active Opportunity) and creates a Resolve Sales Call task instead", async () => {
      fakeDb.current = seedWith();

      const response = await handleScheduled(buildAppointment(), "acuity-2");
      const body = await json(response);

      expect(body).toEqual({ status: "booked", matchReason: "none" });
      expect(fakeDb.current.tables.sales_calls[0].opportunity_id).toBeNull();
      expect(fakeDb.current.tables.tasks).toHaveLength(1);
      expect(fakeDb.current.tables.tasks[0]).toMatchObject({
        type: "resolve_sales_call",
      });
    });

    it("does not fabricate a match for an unmapped Acuity appointment type — no Contact is even created", async () => {
      fakeDb.current = seedWith({ offers: [] });

      const response = await handleScheduled(buildAppointment(), "acuity-3");
      const body = await json(response);

      expect(body).toEqual({ status: "unknown-appointment-type" });
      expect(fakeDb.current.tables.contacts).toHaveLength(0);
      expect(fakeDb.current.tables.sales_calls).toHaveLength(0);
    });

    it("a duplicate webhook delivery for the same appointment id never creates a second Sales Call, Task, or stage re-entry", async () => {
      fakeDb.current = seedWith({
        contacts: [
          {
            id: 1,
            first_name: "Ada",
            last_name: "Lovelace",
            email_jsonb: [{ email: "ada@example.com", type: "Home" }],
          },
        ],
        deals: [
          {
            id: 1,
            contact_id: 1,
            offer_id: 1,
            cohort_id: null,
            stage: "approved",
            outcome: null,
            archived_at: null,
          },
        ],
      });

      await handleScheduled(buildAppointment(), "acuity-dup");
      const secondResponse = await handleScheduled(
        buildAppointment(),
        "acuity-dup",
      );
      const body = await json(secondResponse);

      expect(body).toEqual({ status: "already-booked" });
      expect(fakeDb.current.tables.sales_calls).toHaveLength(1);
      expect(fakeDb.current.tables.sales_call_events).toHaveLength(1);
      expect(fakeDb.current.tables.tasks).toHaveLength(1);
    });

    it("a fresh booking for the same Opportunity completes a pending Sales Call Cancelled task", async () => {
      fakeDb.current = seedWith({
        contacts: [
          {
            id: 1,
            first_name: "Ada",
            last_name: "Lovelace",
            email_jsonb: [{ email: "ada@example.com", type: "Home" }],
          },
        ],
        deals: [
          {
            id: 1,
            contact_id: 1,
            offer_id: 1,
            cohort_id: null,
            stage: "call_booked",
            outcome: null,
            archived_at: null,
          },
        ],
        tasks: [
          {
            id: 1,
            contact_id: 1,
            type: "sales_call_cancelled",
            due_date: "2026-09-05T00:00:00.000Z",
            done_date: null,
            status: "pending",
          },
        ],
      });

      await handleScheduled(buildAppointment(), "acuity-rebook");

      const followUpTask = fakeDb.current.tables.tasks.find(
        (task) => task.id === 1,
      )!;
      expect(followUpTask.status).toBe("completed");
      expect(followUpTask.done_date).toBeTruthy();
    });
  });

  describe("handleRescheduled", () => {
    const bookedFixture = () =>
      seedWith({
        contacts: [
          {
            id: 1,
            first_name: "Ada",
            last_name: "Lovelace",
            email_jsonb: [{ email: "ada@example.com", type: "Home" }],
          },
        ],
        deals: [
          {
            id: 1,
            contact_id: 1,
            offer_id: 1,
            cohort_id: null,
            stage: "call_booked",
            outcome: null,
            archived_at: null,
          },
        ],
        sales_calls: [
          {
            id: 1,
            opportunity_id: 1,
            contact_id: 1,
            status: "booked",
            scheduled_at: "2026-09-10T18:00:00.000Z",
            reschedule_count: 0,
            acuity_appointment_id: "acuity-1",
          },
        ],
        tasks: [
          {
            id: 1,
            contact_id: 1,
            type: "sales_call",
            due_date: "2026-09-10T18:00:00.000Z",
            done_date: null,
            status: "pending",
          },
        ],
      });

    it("updates the same Sales Call row and moves the Task due date, never creating a second booking", async () => {
      fakeDb.current = bookedFixture();

      const response = await handleRescheduled(
        buildAppointment({ datetime: "2026-09-12T20:00:00.000Z" }),
        "acuity-1",
      );
      const body = await json(response);

      expect(body).toEqual({ status: "rescheduled" });
      expect(fakeDb.current.tables.sales_calls).toHaveLength(1);
      expect(fakeDb.current.tables.sales_calls[0]).toMatchObject({
        scheduled_at: "2026-09-12T20:00:00.000Z",
        reschedule_count: 1,
      });
      expect(fakeDb.current.tables.sales_call_events).toHaveLength(1);
      expect(fakeDb.current.tables.sales_call_events[0]).toMatchObject({
        kind: "rescheduled",
        previous_scheduled_at: "2026-09-10T18:00:00.000Z",
        new_scheduled_at: "2026-09-12T20:00:00.000Z",
      });
      expect(fakeDb.current.tables.tasks[0].due_date).toBe(
        "2026-09-12T20:00:00.000Z",
      );
      // A reschedule never touches Opportunity stage.
      expect(fakeDb.current.tables.deals[0].stage).toBe("call_booked");
    });

    it("is idempotent when the 'new' time matches what's already recorded", async () => {
      fakeDb.current = bookedFixture();

      const response = await handleRescheduled(
        buildAppointment({ datetime: "2026-09-10T18:00:00.000Z" }),
        "acuity-1",
      );
      const body = await json(response);

      expect(body).toEqual({ status: "already-current" });
      expect(fakeDb.current.tables.sales_call_events).toHaveLength(0);
    });

    it("refuses to reschedule a cancelled call — out-of-order delivery must not resurrect it", async () => {
      const db = bookedFixture();
      db.tables.sales_calls[0].status = "cancelled";
      fakeDb.current = db;

      const response = await handleRescheduled(
        buildAppointment({ datetime: "2026-09-15T18:00:00.000Z" }),
        "acuity-1",
      );
      const body = await json(response);

      expect(body).toEqual({ status: "cancelled-call" });
      expect(fakeDb.current.tables.sales_calls[0].scheduled_at).toBe(
        "2026-09-10T18:00:00.000Z",
      );
      expect(fakeDb.current.tables.sales_call_events).toHaveLength(0);
    });

    it("treats a reschedule for an appointment id never recorded as the first booking, not a no-op", async () => {
      fakeDb.current = seedWith({
        contacts: [
          {
            id: 1,
            first_name: "Ada",
            last_name: "Lovelace",
            email_jsonb: [{ email: "ada@example.com", type: "Home" }],
          },
        ],
      });

      const response = await handleRescheduled(
        buildAppointment(),
        "acuity-never-seen",
      );
      const body = await json(response);

      expect(body).toMatchObject({ status: "booked" });
      expect(fakeDb.current.tables.sales_calls).toHaveLength(1);
    });
  });

  describe("handleCanceled", () => {
    const bookedFixture = () =>
      seedWith({
        sales_calls: [
          {
            id: 1,
            opportunity_id: 1,
            contact_id: 1,
            status: "booked",
            scheduled_at: "2026-09-10T18:00:00.000Z",
            reschedule_count: 0,
            acuity_appointment_id: "acuity-1",
          },
        ],
        tasks: [
          {
            id: 1,
            contact_id: 1,
            type: "sales_call",
            due_date: "2026-09-10T18:00:00.000Z",
            done_date: null,
            status: "pending",
          },
        ],
      });

    it("marks the call cancelled and cancels the pending task, without touching Opportunity stage", async () => {
      fakeDb.current = bookedFixture();
      fakeDb.current.tables.deals = [
        {
          id: 1,
          contact_id: 1,
          offer_id: 1,
          cohort_id: null,
          stage: "call_booked",
          outcome: null,
          archived_at: null,
        },
      ];

      const response = await handleCanceled("acuity-1");
      const body = await json(response);

      expect(body).toEqual({ status: "cancelled" });
      expect(fakeDb.current.tables.sales_calls[0].status).toBe("cancelled");
      expect(fakeDb.current.tables.sales_calls[0].cancelled_at).toBeTruthy();
      expect(fakeDb.current.tables.sales_call_events).toHaveLength(1);
      expect(fakeDb.current.tables.sales_call_events[0]).toMatchObject({
        kind: "cancelled",
      });
      expect(fakeDb.current.tables.tasks[0].status).toBe("cancelled");
      // Never attendance, never a stage change.
      expect(fakeDb.current.tables.deals[0].stage).toBe("call_booked");
      // GYU real-infrastructure slice, human-acceptance repair pass: the
      // Opportunity is still Call Booked with no active call — a new
      // "decide what happens next" task must exist, not silently strand.
      const followUpTasks = fakeDb.current.tables.tasks.filter(
        (task) => task.type === "sales_call_cancelled",
      );
      expect(followUpTasks).toHaveLength(1);
      expect(followUpTasks[0].status).toBe("pending");
    });

    it("a duplicate cancellation webhook is a safe no-op", async () => {
      const db = bookedFixture();
      db.tables.sales_calls[0].status = "cancelled";
      fakeDb.current = db;

      const response = await handleCanceled("acuity-1");
      const body = await json(response);

      expect(body).toEqual({ status: "already-cancelled" });
      expect(fakeDb.current.tables.sales_call_events).toHaveLength(0);
    });

    it("a cancellation for an appointment id this CRM never recorded is a safe no-op", async () => {
      fakeDb.current = seedWith();

      const response = await handleCanceled("never-seen");
      const body = await json(response);

      expect(body).toEqual({ status: "unknown-appointment" });
      expect(fakeDb.current.tables.sales_call_events).toHaveLength(0);
    });

    it("does not create a follow-up task when the booking was never matched to an Opportunity", async () => {
      const db = bookedFixture();
      db.tables.sales_calls[0].opportunity_id = null;
      fakeDb.current = db;

      await handleCanceled("acuity-1");

      const followUpTasks = fakeDb.current.tables.tasks.filter(
        (task) => task.type === "sales_call_cancelled",
      );
      expect(followUpTasks).toHaveLength(0);
    });

    it("does not create a follow-up task when the Opportunity already moved past Call Booked", async () => {
      fakeDb.current = bookedFixture();
      fakeDb.current.tables.deals = [
        {
          id: 1,
          contact_id: 1,
          offer_id: 1,
          cohort_id: null,
          stage: "committed",
          outcome: null,
          archived_at: null,
        },
      ];

      await handleCanceled("acuity-1");

      const followUpTasks = fakeDb.current.tables.tasks.filter(
        (task) => task.type === "sales_call_cancelled",
      );
      expect(followUpTasks).toHaveLength(0);
    });

    it("does not create a follow-up task when another currently-booked call already covers the Opportunity", async () => {
      fakeDb.current = bookedFixture();
      fakeDb.current.tables.deals = [
        {
          id: 1,
          contact_id: 1,
          offer_id: 1,
          cohort_id: null,
          stage: "call_booked",
          outcome: null,
          archived_at: null,
        },
      ];
      fakeDb.current.tables.sales_calls.push({
        id: 2,
        opportunity_id: 1,
        contact_id: 1,
        status: "booked",
        scheduled_at: "2026-09-12T18:00:00.000Z",
        reschedule_count: 0,
        acuity_appointment_id: "acuity-2",
      });

      await handleCanceled("acuity-1");

      const followUpTasks = fakeDb.current.tables.tasks.filter(
        (task) => task.type === "sales_call_cancelled",
      );
      expect(followUpTasks).toHaveLength(0);
    });
  });
});
