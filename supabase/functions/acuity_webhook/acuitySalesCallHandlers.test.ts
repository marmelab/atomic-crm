// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// The in-memory supabaseAdmin stand-in lives in ./fakeSupabaseAdmin.ts so
// the Acuity agreement contract drives these same handlers through the
// same fake, instead of keeping a second copy that can drift.
import { createFakeDb, type Row } from "./fakeSupabaseAdmin";

const fakeDb = vi.hoisted(() => ({
  current: null as ReturnType<typeof createFakeDb> | null,
}));

vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (table: string) => fakeDb.current!.from(table),
    rpc: (name: string, args: Record<string, unknown>) =>
      fakeDb.current!.rpc(name, args),
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
      // And no Task at all. The booking is a calendar fact the Call Booked
      // stage and the Sales Call row already carry; Leif has nothing to do
      // about it beyond attending, so nothing asks him to.
      expect(fakeDb.current.tables.tasks).toHaveLength(0);
    });

    it("preserves an unmatched booking (no active Opportunity) and asks WHOSE it is, never what happened on it", async () => {
      fakeDb.current = seedWith();

      const response = await handleScheduled(buildAppointment(), "acuity-2");
      const body = await json(response);

      expect(body).toEqual({ status: "booked", matchReason: "none" });
      expect(fakeDb.current.tables.sales_calls[0].opportunity_id).toBeNull();
      expect(fakeDb.current.tables.tasks).toHaveLength(1);
      // The regression this replaces: four real bookings for late October
      // and November reached the Dashboard as "What happened on this
      // call?" because this handler still used the pre-20260918030000
      // combined type. Attendance cannot be a question about a call that
      // has not happened.
      expect(fakeDb.current.tables.tasks[0]).toMatchObject({
        type: "sales_call_needs_matching",
        sales_call_id: fakeDb.current.tables.sales_calls[0].id,
      });
      expect(fakeDb.current.tables.tasks[0].type).not.toBe(
        "resolve_sales_call",
      );
    });

    it("asks nothing about attendance for a booking that is still to come", async () => {
      // The invariant, stated directly: whether matched or not, a future
      // call never produces an attendance-resolution task.
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

      await handleScheduled(buildAppointment(), "acuity-future-matched");
      fakeDb.current.tables.sales_calls = [];
      await handleScheduled(buildAppointment(), "acuity-future-unmatched");

      expect(
        fakeDb.current.tables.tasks.filter(
          (task: { type: string }) => task.type === "resolve_sales_call",
        ),
      ).toHaveLength(0);
      // Nor does it ever record attendance on its own.
      expect(
        fakeDb.current.tables.sales_calls.every(
          (call: { attendance: unknown; resolution_requested_at?: unknown }) =>
            call.attendance == null && call.resolution_requested_at == null,
        ),
      ).toBe(true);
    });

    it("asks Leif which one when two Opportunities could plausibly own the booking", async () => {
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
          {
            id: 2,
            contact_id: 1,
            offer_id: 1,
            cohort_id: null,
            stage: "interested",
            outcome: null,
            archived_at: null,
          },
        ],
      });

      const body = await json(
        await handleScheduled(buildAppointment(), "acuity-ambiguous"),
      );

      expect(body).toEqual({ status: "booked", matchReason: "ambiguous" });
      // Never guessed, never split across both: the booking is preserved
      // unattached with exactly one question against it.
      expect(fakeDb.current.tables.sales_calls[0].opportunity_id).toBeNull();
      expect(fakeDb.current.tables.tasks).toHaveLength(1);
      expect(fakeDb.current.tables.tasks[0].type).toBe(
        "sales_call_needs_matching",
      );
      // And neither Opportunity is moved by a booking nobody has
      // attributed to it.
      expect(fakeDb.current.tables.deals[0].stage).toBe("approved");
      expect(fakeDb.current.tables.deals[1].stage).toBe("interested");
    });

    it("never revives a terminal sales attempt to make a new booking fit", async () => {
      // Mihaela Petrova's shape: her only prior Opportunity had ended.
      // A booking is evidence that somebody wants to talk, never evidence
      // that a closed sale reopened — so the CRM asks rather than decides,
      // and creating the new attempt stays a human action on the matching
      // page.
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
            stage: "decision",
            outcome: "lost",
            archived_at: null,
          },
        ],
      });

      const body = await json(
        await handleScheduled(buildAppointment(), "acuity-terminal"),
      );

      expect(body).toEqual({ status: "booked", matchReason: "none" });
      expect(fakeDb.current.tables.sales_calls[0].opportunity_id).toBeNull();
      // Untouched: same stage, same outcome, and no second Opportunity
      // conjured to receive the booking.
      expect(fakeDb.current.tables.deals).toHaveLength(1);
      expect(fakeDb.current.tables.deals[0]).toMatchObject({
        stage: "decision",
        outcome: "lost",
      });
      expect(fakeDb.current.tables.tasks[0].type).toBe(
        "sales_call_needs_matching",
      );
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
      expect(fakeDb.current.tables.tasks).toHaveLength(0);
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

    it("moves the same Sales Call row in time, never creating a second booking", async () => {
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
      // The legacy appointment Task in this fixture is left exactly as it
      // was: the type is retired, so nothing retargets it any more, and
      // the moved appointment lives on the Sales Call row above.
      expect(fakeDb.current.tables.tasks[0].due_date).toBe(
        "2026-09-10T18:00:00.000Z",
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

    it("leaves the Opportunity where the sale reached, converging with the manual path", async () => {
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
      // The stage is not touched. There was a period when a cancellation
      // wrote it back to Approved so that Call Booked never claimed a
      // booking that had gone; acceptance testing retired that, because
      // Approved says this person never agreed to meet. All three paths
      // go through record_sales_call_cancelled(), so they agree either
      // way — that convergence is what this asserts.
      expect(fakeDb.current.tables.deals[0].stage).toBe("call_booked");
      // Attendance is still never invented: nobody showed up or failed to.
      expect(fakeDb.current.tables.sales_calls[0].attendance).toBeUndefined();
      // The "decide what happens next" task is NOT created, and must not
      // be: the open question is DERIVED from the call facts
      // (needsNextSalesStep), so a task duplicating it could be deleted
      // while the question remained.
      const followUpTasks = fakeDb.current.tables.tasks.filter(
        (task) => task.type === "sales_call_cancelled",
      );
      expect(followUpTasks).toHaveLength(0);
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
