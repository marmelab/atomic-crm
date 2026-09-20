// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type Row } from "./fakeSupabaseAdmin";
import vectors from "../../../contracts/sales-calls/openQuestionVectors.json";
import writers from "../../../contracts/sales-calls/writers.json";

// The EDGE arm of the cross-runtime agreement, and the Edge half of the
// writer inventory.
//
// This handler is where the regression actually lived. Migration
// 20260918030000 split one overloaded Task type into two questions; the
// app was updated and this file was not, because a Deno Edge Function
// cannot import from src/ and its copy of the type was written by hand.
// Four real bookings for late October and November then reached the
// Dashboard asking what had happened on calls that had not happened.
//
// Nothing here greps for a string. The handler is RUN, against the same
// canonical vectors the database and the app are held to, and what it
// actually writes is what gets asserted.
//
// Only the vectors marked `edge.reachable` describe a state a fresh Acuity
// booking can be in: always booked, never dismissed, no attendance, no
// resolution requested. The others belong to later life stages this
// handler does not create.

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

import { handleScheduled } from "./acuitySalesCallHandlers";
import type { AcuityAppointmentDetails } from "./acuityApi";

const APPOINTMENT_TYPE_ID = "111";
const CONTACT_EMAIL = "ada@example.com";
const NOW = new Date(vectors.now);

const appointmentAt = (datetime: string): AcuityAppointmentDetails => ({
  email: CONTACT_EMAIL,
  firstName: "Ada",
  lastName: "Lovelace",
  datetime,
  appointmentTypeID: Number(APPOINTMENT_TYPE_ID),
});

const seed = ({ matched }: { matched: boolean }) => {
  const contacts: Row[] = [
    {
      id: 1,
      first_name: "Ada",
      last_name: "Lovelace",
      email_jsonb: [{ email: CONTACT_EMAIL, type: "Home" }],
    },
  ];
  // Matched means exactly one compatible ACTIVE Opportunity — the only
  // shape Acuity is allowed to attach to on its own. Zero is an
  // escalation, not a licence to invent one.
  const deals: Row[] = matched
    ? [
        {
          id: 1,
          contact_id: 1,
          offer_id: 1,
          cohort_id: null,
          stage: "approved",
          outcome: null,
          archived_at: null,
        },
      ]
    : [];

  return createFakeDb({
    offers: [
      {
        id: 1,
        name: "The Living Example",
        type: "individual",
        acuity_appointment_type_id: APPOINTMENT_TYPE_ID,
      },
    ],
    cohorts: [],
    contacts,
    deals,
    sales_calls: [],
    sales_call_events: [],
    tasks: [],
    sales: [{ id: 1, administrator: true }],
  });
};

const edgeReachable = vectors.vectors.filter((vector) => vector.edge.reachable);

describe("acuity_webhook agrees with the canonical open-question contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("has edge-reachable vectors to check, so an emptied contract cannot pass", () => {
    expect(edgeReachable.length).toBeGreaterThan(0);
  });

  it.each(
    edgeReachable.map(
      (vector) => [vector.id, vector.expected_question, vector] as const,
    ),
  )(
    "%s — the booking it creates asks %s, and asks it with the contract's Task type",
    async (_id, expected, vector) => {
      fakeDb.current = seed({ matched: vector.edge.matched === true });

      const scheduledAt = vector.call.scheduled_at;
      expect(
        scheduledAt,
        "an edge-reachable vector must carry an exact instant",
      ).not.toBeNull();

      await handleScheduled(appointmentAt(scheduledAt!), `acuity-${vector.id}`);

      const call = fakeDb.current.tables.sales_calls[0];
      expect(call, "the handler created no Sales Call").toBeDefined();

      const salesCallTasks = fakeDb.current.tables.tasks.filter(
        (task) => task.sales_call_id === call.id,
      );

      const expectedType =
        vectors.task_type_for_question[
          expected as keyof typeof vectors.task_type_for_question
        ];

      if (expectedType === null) {
        expect(
          salesCallTasks,
          `${vector.description} — the contract says this booking asks nothing, so it must create no Task`,
        ).toEqual([]);
        return;
      }

      expect(salesCallTasks).toHaveLength(1);
      expect(
        salesCallTasks[0].type,
        `${vector.description} — the contract says this booking asks "${expected}"`,
      ).toBe(expectedType);
    },
  );

  // Stated on its own as well as through the vectors, because it is the
  // exact sentence that was false in production for three weeks.
  it("never asks what happened on a booking it is creating", async () => {
    for (const vector of edgeReachable) {
      fakeDb.current = seed({ matched: vector.edge.matched === true });
      await handleScheduled(
        appointmentAt(vector.call.scheduled_at!),
        `acuity-${vector.id}`,
      );
      const types = fakeDb.current.tables.tasks.map((task) => task.type);
      expect(
        types,
        `${vector.id} produced an attendance question about a booking that was just made`,
      ).not.toContain("resolve_sales_call");
    }
  });

  it("never projects the appointment itself into the Task system", async () => {
    for (const vector of edgeReachable) {
      fakeDb.current = seed({ matched: vector.edge.matched === true });
      await handleScheduled(
        appointmentAt(vector.call.scheduled_at!),
        `acuity-${vector.id}`,
      );
      expect(
        fakeDb.current.tables.tasks.map((task) => task.type),
      ).not.toContain("sales_call");
    }
  });
});

describe("edge.acuity_handle_scheduled supplies exactly what the inventory says", () => {
  const writer = writers.writers.find(
    (candidate) => candidate.id === "edge.acuity_handle_scheduled",
  )!;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("is in the inventory at all", () => {
    expect(writer).toBeDefined();
    expect(writer.runtime).toBe("supabase edge function (deno)");
    expect(writer.auth_role).toBe("service_role");
  });

  it("sends the inventoried column set, and nothing else", async () => {
    fakeDb.current = seed({ matched: true });

    await handleScheduled(
      appointmentAt("2026-10-29T17:00:00.000Z"),
      "acuity-inventory",
    );

    const row = { ...fakeDb.current.tables.sales_calls[0] };
    // The fake assigns the id the database would.
    delete row.id;

    expect(Object.keys(row).sort()).toEqual([...writer.supplies].sort());
  });

  it("leaves every database-derived column to the database", async () => {
    fakeDb.current = seed({ matched: false });

    // The instant that breaks a naive UTC date cast: 19:30 on 29 October
    // in Denver is already 30 October in UTC.
    await handleScheduled(
      appointmentAt("2026-10-30T01:30:00.000Z"),
      "acuity-derived",
    );

    const row = fakeDb.current.tables.sales_calls[0];
    for (const derived of writer.derived_by_database) {
      if (derived === "id") continue;
      expect(
        Object.keys(row),
        `handleScheduled supplied ${derived}, which the database is supposed to derive`,
      ).not.toContain(derived);
    }
    expect(Object.keys(row)).not.toContain("scheduled_on");
  });

  it("writes the booked event it owns", async () => {
    fakeDb.current = seed({ matched: true });

    await handleScheduled(
      appointmentAt("2026-10-29T17:00:00.000Z"),
      "acuity-event",
    );

    expect(fakeDb.current.tables.sales_call_events).toHaveLength(1);
    expect(fakeDb.current.tables.sales_call_events[0]).toMatchObject({
      kind: "booked",
    });
  });

  it("advances Approved -> Call Booked when it matched, and only then", async () => {
    fakeDb.current = seed({ matched: true });
    await handleScheduled(
      appointmentAt("2026-10-29T17:00:00.000Z"),
      "acuity-a",
    );
    expect(fakeDb.current.tables.deals[0].stage).toBe("call_booked");

    fakeDb.current = seed({ matched: false });
    await handleScheduled(
      appointmentAt("2026-10-29T17:00:00.000Z"),
      "acuity-b",
    );
    expect(
      fakeDb.current.tables.deals,
      "Acuity created an Opportunity out of a booking it could not attribute",
    ).toEqual([]);
  });
});
