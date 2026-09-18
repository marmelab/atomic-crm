// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Reconciliation is the half a webhook cannot do, so what has to be proven
// is not "it ingests a booking" but the two properties that make a
// scheduled repair safe to run forever: it changes nothing when nothing
// changed upstream, and it never overturns a decision Leif made.

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  nextId: 1000,
  handled: [] as { handler: string; acuityId: string }[],
  appointments: null as Row[] | null,
  byId: {} as Record<string, Row>,
}));

vi.mock("../_shared/supabaseAdmin.ts", () => {
  const matches = (row: Row, filters: [string, string, unknown][]) =>
    filters.every(([field, op, value]) =>
      op === "gte" ? String(row[field]) >= String(value) : row[field] === value,
    );

  const from = (table: string) => {
    state.tables[table] ??= [];
    const filters: [string, string, unknown][] = [];
    let headCount = false;

    const builder: Record<string, unknown> = {
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        headCount = Boolean(opts?.head);
        return builder;
      },
      eq(field: string, value: unknown) {
        filters.push([field, "eq", value]);
        return builder;
      },
      gte(field: string, value: unknown) {
        filters.push([field, "gte", value]);
        return builder;
      },
      maybeSingle: () =>
        Promise.resolve({
          data: state.tables[table].find((r) => matches(r, filters)) ?? null,
          error: null,
        }),
      then(resolve: (v: unknown) => void) {
        const data = state.tables[table].filter((r) => matches(r, filters));
        resolve(
          headCount
            ? { data: null, count: data.length, error: null }
            : { data, error: null },
        );
      },
    };
    return builder;
  };

  // Faithful stand-in for record_sales_call_reinstated(): refuses a
  // concluded call and refuses a past one, exactly as the real function
  // does, so the test cannot pass on a laxer fake than production runs.
  const rpc = (name, args) => {
    if (name !== "record_sales_call_reinstated") {
      return Promise.resolve({ data: null, error: null });
    }
    const call = (state.tables.sales_calls ?? []).find(
      (c) => c.id === args.p_sales_call_id,
    );
    if (!call)
      return Promise.resolve({ data: { status: "not-found" }, error: null });
    if (call.attendance != null) {
      return Promise.resolve({
        data: { status: "already-concluded" },
        error: null,
      });
    }
    if (new Date(String(call.scheduled_at)).getTime() <= Date.now()) {
      return Promise.resolve({ data: { status: "in-the-past" }, error: null });
    }
    call.status = "booked";
    call.cancelled_at = null;
    for (const deal of state.tables.deals ?? []) {
      if (deal.id === call.opportunity_id && deal.stage === "approved") {
        deal.stage = "call_booked";
      }
    }
    return Promise.resolve({ data: { status: "reinstated" }, error: null });
  };

  return { supabaseAdmin: { from, rpc } };
});

// The handlers are the webhook's own, already covered by their own file.
// Here they are observed, not re-tested: what matters is WHICH one
// reconciliation decides to call, and how often.
vi.mock("./acuitySalesCallHandlers.ts", () => ({
  handleScheduled: (appointment: Row, acuityId: string) => {
    state.handled.push({ handler: "scheduled", acuityId });
    state.tables.sales_calls.push({
      id: state.nextId++,
      acuity_appointment_id: acuityId,
      acuity_appointment_type_id: String(appointment.appointmentTypeID),
      opportunity_id: 1,
      contact_id: 1,
      status: "booked",
      scheduled_at: appointment.datetime,
      scheduled_on: String(appointment.datetime).slice(0, 10),
    });
    return Promise.resolve(new Response(JSON.stringify({ status: "booked" })));
  },
  handleRescheduled: (appointment: Row, acuityId: string) => {
    state.handled.push({ handler: "rescheduled", acuityId });
    const call = state.tables.sales_calls.find(
      (c) => c.acuity_appointment_id === acuityId,
    );
    if (call) {
      call.scheduled_at = appointment.datetime;
      call.scheduled_on = String(appointment.datetime).slice(0, 10);
    }
    return Promise.resolve(
      new Response(JSON.stringify({ status: "rescheduled" })),
    );
  },
  handleCanceled: (acuityId: string) => {
    state.handled.push({ handler: "canceled", acuityId });
    const call = state.tables.sales_calls.find(
      (c) => c.acuity_appointment_id === acuityId,
    );
    if (call) call.status = "cancelled";
    return Promise.resolve(
      new Response(JSON.stringify({ status: "cancelled" })),
    );
  },
  jsonResponse: (body: unknown) => new Response(JSON.stringify(body)),
}));

vi.mock("./acuityApi.ts", () => ({
  fetchAcuityAppointments: () =>
    Promise.resolve(state.appointments as unknown as Row[] | null),
  fetchAcuityAppointment: (id: string) =>
    Promise.resolve(state.byId[id] ?? null),
}));

import { reconcileAcuity } from "./acuityReconcile";

const GYU_TYPE = "64654501";
const LE_TYPE = "91345095";
const CLIENT_SESSION_TYPE = "90522599";

const appointment = (over: Partial<Row> = {}): Row => ({
  id: 900001,
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  datetime: "2026-10-16T17:00:00.000Z",
  appointmentTypeID: Number(GYU_TYPE),
  canceled: false,
  ...over,
});

const seed = (over: Partial<Record<string, Row[]>> = {}) => {
  state.tables = {
    contacts: [{ id: 1, first_name: "Ada", last_name: "Lovelace" }],
    deals: [{ id: 1, contact_id: 1, stage: "call_booked" }],
    sales_calls: [],
    tasks: [],
    deal_stage_events: [],
    acuity_appointment_type_map: [
      {
        acuity_appointment_type_id: GYU_TYPE,
        kind: "sales_call",
        resolution: "mapped",
      },
      {
        acuity_appointment_type_id: LE_TYPE,
        kind: "sales_call",
        resolution: "mapped",
      },
      {
        acuity_appointment_type_id: CLIENT_SESSION_TYPE,
        kind: "client_session",
        resolution: "mapped",
      },
      // The interval on 64654501 nothing establishes — present in the map
      // so reconciliation can see it is undetermined rather than missing.
      {
        acuity_appointment_type_id: "64654501-undetermined",
        kind: "sales_call",
        resolution: "unknown",
      },
    ],
    ...over,
  };
  state.handled = [];
  state.nextId = 1000;
  state.byId = {};
};

const credentials = { userId: "u", apiKey: "k" };

describe("acuity reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seed();
  });
  afterAll(() => vi.resetAllMocks());

  it("creates the Sales Call for a booking the webhook never delivered", async () => {
    state.appointments = [appointment()];

    const delta = await reconcileAcuity({ credentials });

    expect(delta.salesCallsCreated).toBe(1);
    expect(state.handled).toEqual([
      { handler: "scheduled", acuityId: "900001" },
    ]);
  });

  it("a second run against unchanged upstream data changes nothing at all", async () => {
    state.appointments = [appointment()];
    await reconcileAcuity({ credentials });

    const rowsAfterFirst = JSON.parse(JSON.stringify(state.tables));
    state.handled = [];

    const second = await reconcileAcuity({ credentials });

    expect(second.salesCallsCreated).toBe(0);
    expect(second.contactsCreated).toBe(0);
    expect(second.opportunitiesCreated).toBe(0);
    expect(second.rescheduled).toBe(0);
    expect(second.cancelled).toBe(0);
    expect(second.unchanged).toBe(1);
    // Nothing was written, not even a redundant update.
    expect(state.handled).toEqual([]);
    expect(state.tables).toEqual(rowsAfterFirst);
  });

  it("repairs a reschedule that arrived out of order or not at all", async () => {
    state.appointments = [appointment()];
    await reconcileAcuity({ credentials });
    state.handled = [];

    state.appointments = [
      appointment({ datetime: "2026-10-20T17:00:00.000Z" }),
    ];
    const delta = await reconcileAcuity({ credentials });

    expect(delta.rescheduled).toBe(1);
    expect(state.handled).toEqual([
      { handler: "rescheduled", acuityId: "900001" },
    ]);
    expect(state.tables.sales_calls[0].scheduled_at).toBe(
      "2026-10-20T17:00:00.000Z",
    );
  });

  // Mihaela Petrova. Her Opportunity read Approved/No-show while Acuity
  // held a live, uncancelled appointment for the next day — the same
  // appointment id the CRM had marked cancelled. Acuity is authoritative
  // for whether a call is booked, so a live FUTURE booking is reinstated.
  it("reinstates a cancelled call that Acuity still holds live in the future", async () => {
    const at = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
    state.tables.sales_calls = [
      {
        id: 140,
        acuity_appointment_id: "1747612375",
        acuity_appointment_type_id: GYU_TYPE,
        opportunity_id: 163,
        contact_id: 170,
        status: "cancelled",
        attendance: null,
        scheduled_at: at,
        scheduled_on: at.slice(0, 10),
      },
    ];
    state.tables.deals = [{ id: 163, contact_id: 170, stage: "approved" }];
    state.appointments = [
      appointment({
        id: 1747612375,
        firstName: "Mihaela",
        lastName: "Petrova",
        datetime: at,
        canceled: false,
      }),
    ];

    const delta = await reconcileAcuity({ credentials });

    expect(delta.reinstated).toBe(1);
    expect(delta.skippedOwnerOverride).toBe(0);
    expect(state.tables.sales_calls[0].status).toBe("booked");
    expect(state.tables.sales_calls[0].cancelled_at).toBeNull();
    // And the Opportunity follows back to Call Booked.
    expect(state.tables.deals[0].stage).toBe("call_booked");
  });

  // Aurelie Boleor. Her only appointment was two days ago and Leif
  // cancelled it by agreement without touching Acuity, which still says
  // it was never cancelled. The CRM owns what happened to a past call.
  it("never resurrects a PAST cancelled call from stale upstream state", async () => {
    const at = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    state.tables.sales_calls = [
      {
        id: 36,
        acuity_appointment_id: "1742423187",
        acuity_appointment_type_id: LE_TYPE,
        opportunity_id: 68,
        contact_id: 80,
        status: "cancelled",
        attendance: null,
        scheduled_at: at,
        scheduled_on: at.slice(0, 10),
      },
    ];
    state.tables.deals = [{ id: 68, contact_id: 80, stage: "approved" }];
    state.appointments = [
      appointment({
        id: 1742423187,
        appointmentTypeID: Number(LE_TYPE),
        firstName: "Aurelie",
        lastName: "Boleor",
        datetime: at,
        canceled: false,
      }),
    ];

    const delta = await reconcileAcuity({ credentials });

    expect(delta.reinstated).toBe(0);
    expect(delta.skippedOwnerOverride).toBe(1);
    expect(state.tables.sales_calls[0].status).toBe("cancelled");
    expect(state.tables.deals[0].stage).toBe("approved");
  });

  it("never reopens a call whose attendance a human already recorded", async () => {
    const at = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
    state.tables.sales_calls = [
      {
        id: 50,
        acuity_appointment_id: "900500",
        acuity_appointment_type_id: GYU_TYPE,
        opportunity_id: 1,
        contact_id: 1,
        status: "cancelled",
        attendance: "no_show",
        scheduled_at: at,
        scheduled_on: at.slice(0, 10),
      },
    ];
    state.appointments = [appointment({ id: 900500, datetime: at })];

    const delta = await reconcileAcuity({ credentials });

    expect(delta.reinstated).toBe(0);
    expect(delta.skippedOwnerOverride).toBe(1);
    expect(state.tables.sales_calls[0].attendance).toBe("no_show");
  });

  it("a genuinely new booking is still ingested alongside a preserved past cancellation", async () => {
    const past = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const soon = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    state.tables.sales_calls = [
      {
        id: 36,
        acuity_appointment_id: "1742423187",
        acuity_appointment_type_id: GYU_TYPE,
        opportunity_id: 68,
        contact_id: 80,
        status: "cancelled",
        attendance: null,
        scheduled_at: past,
        scheduled_on: past.slice(0, 10),
      },
    ];
    state.appointments = [
      appointment({ id: 1742423187, datetime: past }),
      appointment({ id: 1999999, datetime: soon }),
    ];

    const delta = await reconcileAcuity({ credentials });

    expect(delta.skippedOwnerOverride).toBe(1);
    expect(delta.salesCallsCreated).toBe(1);
    expect(state.handled).toEqual([
      { handler: "scheduled", acuityId: "1999999" },
    ]);
  });
  it("cancels a booking only on a confirmed upstream cancellation, never on absence", async () => {
    state.tables.sales_calls = [
      {
        id: 5,
        acuity_appointment_id: "555",
        acuity_appointment_type_id: GYU_TYPE,
        opportunity_id: 1,
        contact_id: 1,
        status: "booked",
        scheduled_at: "2026-10-16T17:00:00.000Z",
        scheduled_on: "2026-10-16",
      },
    ];
    // Missing from the page, and Acuity confirms it really was cancelled.
    state.appointments = [];
    state.byId["555"] = appointment({ id: 555, canceled: true });

    const delta = await reconcileAcuity({ credentials });

    expect(delta.cancelled).toBe(1);
    expect(state.handled).toEqual([{ handler: "canceled", acuityId: "555" }]);
  });

  it("leaves a booking alone when it is missing from the page but still live upstream", async () => {
    state.tables.sales_calls = [
      {
        id: 5,
        acuity_appointment_id: "555",
        acuity_appointment_type_id: GYU_TYPE,
        opportunity_id: 1,
        contact_id: 1,
        status: "booked",
        scheduled_at: "2026-10-16T17:00:00.000Z",
        scheduled_on: "2026-10-16",
      },
    ];
    state.appointments = [];
    // A pagination or window edge, not a cancellation.
    state.byId["555"] = appointment({ id: 555, canceled: false });

    const delta = await reconcileAcuity({ credentials });

    expect(delta.cancelled).toBe(0);
    expect(state.handled).toEqual([]);
    expect(state.tables.sales_calls[0].status).toBe("booked");
  });

  it("never cancels anything when it cannot confirm the appointment upstream", async () => {
    state.tables.sales_calls = [
      {
        id: 5,
        acuity_appointment_id: "555",
        acuity_appointment_type_id: GYU_TYPE,
        opportunity_id: 1,
        contact_id: 1,
        status: "booked",
        scheduled_at: "2026-10-16T17:00:00.000Z",
        scheduled_on: "2026-10-16",
      },
    ];
    state.appointments = [];
    state.byId = {}; // the lookup fails

    const delta = await reconcileAcuity({ credentials });

    expect(delta.cancelled).toBe(0);
    expect(delta.errors).toHaveLength(1);
    expect(state.tables.sales_calls[0].status).toBe("booked");
  });

  it("never turns a client-session booking into a sales Opportunity", async () => {
    state.appointments = [
      appointment({ id: 777, appointmentTypeID: Number(CLIENT_SESSION_TYPE) }),
    ];

    const delta = await reconcileAcuity({ credentials });

    expect(delta.salesCallsCreated).toBe(0);
    expect(delta.skippedClientSession).toBe(1);
    expect(state.handled).toEqual([]);
  });

  it("writes nothing at all when Acuity cannot be read", async () => {
    state.appointments = null;
    const before = JSON.parse(JSON.stringify(state.tables));

    const delta = await reconcileAcuity({ credentials });

    expect(delta.errors).toEqual(["could not read appointments from Acuity"]);
    expect(delta.salesCallsCreated).toBe(0);
    // An empty read must never be mistaken for "Acuity has no bookings".
    expect(delta.cancelled).toBe(0);
    expect(state.tables).toEqual(before);
  });
});
