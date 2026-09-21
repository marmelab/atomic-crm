import { createClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";

// The session schedule rebuild, asked of a real database by doing it.
//
// The rules live in a Postgres function, and a function that renumbers
// rows under a partial unique index, retires some and deletes others is
// not something a unit test can honestly stand in for. Every case below is
// executed against real Postgres, in a transaction-shaped setup that is
// cleaned up afterwards.
//
// What it protects: an Enrollment must never carry two timelines. That is
// what happened when the capacity board moved onto the owner-stated Start
// Dates while enrollment_expected_sessions stayed append-only, still
// numbered from the imported ones.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341";

const db = () =>
  createClient(SUPABASE_URL, process.env.SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

// A Monday, and the weekly `1:1s` weeks after it.
const MONDAY = "2026-01-05";
const weekStart = (index: number) => {
  const date = new Date(`${MONDAY}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + index * 7);
  return date.toISOString().slice(0, 10);
};
const weekEnd = (index: number) => {
  const date = new Date(`${weekStart(index)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 5);
  return date.toISOString().slice(0, 10);
};

const CONTACT_ID = 970001;
const DEAL_ID = 970001;
const CALENDAR = "rebuild-spec-cal";

type Ctx = { client: ReturnType<typeof db>; enrollmentId: number };

const cleanup = async (client: ReturnType<typeof db>) => {
  await client.from("deals").delete().eq("id", DEAL_ID);
  await client.from("contacts").delete().eq("id", CONTACT_ID);
  await client
    .from("expected_session_windows")
    .delete()
    .eq("external_calendar_id", CALENDAR);
};

// `count` weekly windows, skipping any index listed in `closed`.
const seedCalendar = async (
  client: ReturnType<typeof db>,
  count: number,
  closed: number[] = [],
) => {
  const rows = [];
  for (let i = 0; i < count + closed.length; i++) {
    if (closed.includes(i)) continue;
    rows.push({
      offer_id: 1,
      external_calendar_id: CALENDAR,
      external_event_id: `w${i}`,
      raw_title: "1:1s",
      window_start: weekStart(i),
      window_end: weekEnd(i),
    });
  }
  const { error } = await client.from("expected_session_windows").insert(rows);
  expect(error).toBeNull();
};

// The fixture truncates between tests, sales included, so this makes its
// own. Every row below goes through the real write paths: Won creates the
// Enrollment through the live trigger, exactly as a real sale does.
const seedClient = async (
  startDate: string,
  createSales: (args: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  }) => Promise<{ id: number | string }>,
): Promise<Ctx> => {
  // No cleanup here: the calendar is seeded before this runs, and afterEach
  // clears everything between tests.
  const client = db();

  const sales = await createSales({
    first_name: "Rebuild",
    last_name: "Spec",
    email: `rebuild-spec-${Date.now()}@example.com`,
    password: "Password123!",
  });
  const salesId = sales.id;

  const contactInsert = await client.from("contacts").insert({
    id: CONTACT_ID,
    first_name: "Rebuild",
    last_name: "Spec",
    sales_id: salesId,
  });
  expect(contactInsert.error).toBeNull();
  // Won creates the Enrollment through the live trigger — the same path a
  // real sale takes, not a hand-built row.
  const dealInsert = await client.from("deals").insert({
    id: DEAL_ID,
    name: "Rebuild Spec",
    contact_id: CONTACT_ID,
    offer_id: 1,
    stage: "won",
    amount: 4000,
    sales_id: salesId,
    index: 0,
  });
  expect(dealInsert.error).toBeNull();

  const { data: enrollment, error: enrollmentError } = await client
    .from("enrollments")
    .select("id")
    .eq("opportunity_id", DEAL_ID)
    .single();
  expect(enrollmentError).toBeNull();

  const started = await client
    .from("enrollments")
    .update({ start_date: startDate, start_date_source: "owner" })
    .eq("id", enrollment!.id);
  expect(started.error).toBeNull();

  return { client, enrollmentId: enrollment!.id };
};

const liveSlots = async (ctx: Ctx) => {
  const { data } = await ctx.client
    .from("enrollment_expected_sessions")
    .select("id, ordinal, window_start, retired_at")
    .eq("enrollment_id", ctx.enrollmentId)
    .is("retired_at", null)
    .order("ordinal");
  return data ?? [];
};

const rebuild = async (ctx: Ctx) => {
  const { data, error } = await ctx.client.rpc(
    "rebuild_enrollment_expected_sessions",
    { p_enrollment_id: ctx.enrollmentId },
  );
  expect(error).toBeNull();
  return Array.isArray(data) ? data[0] : data;
};

test.describe("a derived session schedule rebuilds from its authorities", () => {
  test.afterEach(async () => {
    await cleanup(db());
  });

  test("Session Week #1 is the week the Start Date falls in, and closed weeks do not count", async ({
    createSales,
  }) => {
    const client = db();
    await cleanup(client);
    // Weeks 5 and 6 are closed — Leif is away.
    await seedCalendar(client, 14, [5, 6]);
    // A Wednesday inside week 0.
    const ctx = await seedClient(
      weekStart(0).replace(/(\d\d)$/, "07"),
      createSales,
    );

    const slots = await liveSlots(ctx);
    expect(slots).toHaveLength(12);
    expect(slots[0]!.window_start).toBe(weekStart(0));
    // Neither closed week was assigned.
    expect(slots.map((s) => s.window_start)).not.toContain(weekStart(5));
    expect(slots.map((s) => s.window_start)).not.toContain(weekStart(6));
    // Twelve OPEN weeks, so the last one is two weeks later than a naive
    // count would put it.
    expect(slots[11]!.window_start).toBe(weekStart(13));
  });

  test("a rebuild is idempotent", async ({ createSales }) => {
    const client = db();
    await cleanup(client);
    await seedCalendar(client, 14);
    const ctx = await seedClient(weekStart(0), createSales);

    const before = await liveSlots(ctx);
    const result = await rebuild(ctx);
    expect(result.inserted).toBe(0);
    expect(result.renumbered).toBe(0);
    expect(result.discarded).toBe(0);
    expect(result.retired_with_history).toBe(0);
    expect(await liveSlots(ctx)).toEqual(before);
  });

  test("correcting the Start Date rebuilds the schedule in the same statement", async ({
    createSales,
  }) => {
    const client = db();
    await cleanup(client);
    await seedCalendar(client, 20);
    const ctx = await seedClient(weekStart(0), createSales);
    expect((await liveSlots(ctx))[0]!.window_start).toBe(weekStart(0));

    // No explicit rebuild call — the trigger is the point.
    await ctx.client
      .from("enrollments")
      .update({ start_date: weekStart(4) })
      .eq("id", ctx.enrollmentId);

    const slots = await liveSlots(ctx);
    expect(slots).toHaveLength(12);
    expect(slots[0]!.window_start).toBe(weekStart(4));
    expect(slots[11]!.window_start).toBe(weekStart(15));
  });

  test("an owner's cadence decision survives a rebuild and follows its own week", async ({
    createSales,
  }) => {
    const client = db();
    await cleanup(client);
    await seedCalendar(client, 20);
    const ctx = await seedClient(weekStart(0), createSales);

    // Leif classifies week 3 (index 2): she told him she was away.
    const slots = await liveSlots(ctx);
    const week3 = slots.find((s) => s.ordinal === 3)!;
    const { data: issue } = await ctx.client
      .from("client_session_cadence_issues")
      .insert({
        enrollment_id: ctx.enrollmentId,
        enrollment_expected_session_id: week3.id,
        classification: "known_skip",
        note: "Away that week",
        resolved_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    // The Start Date moves two weeks later, so that same calendar week is
    // now Session Week #1.
    await ctx.client
      .from("enrollments")
      .update({ start_date: week3.window_start })
      .eq("id", ctx.enrollmentId);

    const { data: after } = await ctx.client
      .from("client_session_cadence_issues")
      .select("id, classification, note, enrollment_expected_session_id")
      .eq("id", issue!.id)
      .single();

    // Same row, same decision, same note — nothing was regenerated.
    expect(after!.classification).toBe("known_skip");
    expect(after!.note).toBe("Away that week");
    expect(after!.enrollment_expected_session_id).toBe(week3.id);

    // And the slot it points at is now numbered 1, because that is what
    // that week has become.
    const { data: slot } = await ctx.client
      .from("enrollment_expected_sessions")
      .select("ordinal, window_start, retired_at")
      .eq("id", week3.id)
      .single();
    expect(slot!.ordinal).toBe(1);
    expect(slot!.window_start).toBe(week3.window_start);
    expect(slot!.retired_at).toBeNull();
  });

  test("a cross-week reschedule adds exactly one eligible week; a skip adds none", async ({
    createSales,
  }) => {
    const client = db();
    await cleanup(client);
    await seedCalendar(client, 20);
    const ctx = await seedClient(weekStart(0), createSales);

    const slots = await liveSlots(ctx);
    const { data: issue } = await ctx.client
      .from("client_session_cadence_issues")
      .insert({
        enrollment_id: ctx.enrollmentId,
        enrollment_expected_session_id: slots[1]!.id,
        classification: "rescheduled",
      })
      .select("id")
      .single();

    let result = await rebuild(ctx);
    expect(result.required_weeks).toBe(13);
    expect(result.inserted).toBe(1);
    let live = await liveSlots(ctx);
    expect(live).toHaveLength(13);
    expect(live[12]!.window_start).toBe(weekStart(12));

    // Reclassified as a skip: the entitlement is forfeited, and the
    // thirteenth week goes away again.
    await ctx.client
      .from("client_session_cadence_issues")
      .update({ classification: "known_skip" })
      .eq("id", issue!.id);
    result = await rebuild(ctx);
    expect(result.required_weeks).toBe(12);
    expect(result.discarded).toBe(1);
    live = await liveSlots(ctx);
    expect(live).toHaveLength(12);
  });

  test("actual sessions are never touched by a rebuild", async ({
    createSales,
  }) => {
    const client = db();
    await cleanup(client);
    await seedCalendar(client, 20);
    const ctx = await seedClient(weekStart(0), createSales);

    const scheduledAt = `${weekStart(1)}T15:00:00.000Z`;
    await ctx.client.from("client_sessions").insert({
      contact_id: CONTACT_ID,
      offer_id: 1,
      scheduled_at: scheduledAt,
      status: "booked",
      source: "acuity",
    });

    await ctx.client
      .from("enrollments")
      .update({ start_date: weekStart(6) })
      .eq("id", ctx.enrollmentId);
    await rebuild(ctx);

    const { data: sessions } = await ctx.client
      .from("client_sessions")
      .select("scheduled_at, status, source, no_show_at")
      .eq("contact_id", CONTACT_ID);
    expect(sessions).toHaveLength(1);
    expect(sessions![0]!.status).toBe("booked");
    expect(sessions![0]!.source).toBe("acuity");
    expect(sessions![0]!.no_show_at).toBeNull();
    expect(new Date(sessions![0]!.scheduled_at as string).toISOString()).toBe(
      scheduledAt,
    );
  });

  test("a calendar too short leaves the schedule short rather than inventing weeks", async ({
    createSales,
  }) => {
    const client = db();
    await cleanup(client);
    await seedCalendar(client, 8);
    const ctx = await seedClient(weekStart(0), createSales);

    const result = await rebuild(ctx);
    expect(result.required_weeks).toBe(12);
    expect(result.canonical_weeks).toBe(8);
    expect(await liveSlots(ctx)).toHaveLength(8);

    // Four more `1:1s` weeks, and the container completes — the Sync
    // Calendar case.
    await client.from("expected_session_windows").insert(
      [8, 9, 10, 11].map((i) => ({
        offer_id: 1,
        external_calendar_id: CALENDAR,
        external_event_id: `w${i}`,
        raw_title: "1:1s",
        window_start: weekStart(i),
        window_end: weekEnd(i),
      })),
    );
    const after = await rebuild(ctx);
    expect(after.canonical_weeks).toBe(12);
    expect(after.inserted).toBe(4);
    expect(await liveSlots(ctx)).toHaveLength(12);
  });
});
