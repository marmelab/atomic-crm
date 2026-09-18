// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// One commercial agreement can be carried by several Stripe objects over
// time. What has to be proven is that a replacement is ADDED rather than
// substituted: the subscription that collected four payments stays on the
// record after it ends.

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  updates: [] as Row[],
}));

vi.mock("../_shared/supabaseAdmin.ts", () => {
  const from = () => ({
    select: () => ({
      eq: async () => ({
        data: state.rows.map((r) => ({ ...r })),
        error: null,
      }),
    }),
    insert: async (row: Row) => {
      const clash = state.rows.some(
        (existing) => existing.stripe_object_id === row.stripe_object_id,
      );
      if (clash) return { error: { code: "23505", message: "duplicate" } };
      state.rows.push({ ...row });
      return { error: null };
    },
    update: (patch: Row) => ({
      eq: async (_column: string, value: string) => {
        const row = state.rows.find((r) => r.stripe_object_id === value);
        if (row) Object.assign(row, patch);
        state.updates.push({ stripe_object_id: value, ...patch });
        return { error: null };
      },
    }),
  });
  return { supabaseAdmin: { from } };
});

const { recordPlanObjects } = await import("./stripePlanObjects.ts");

const SECONDS = 1_746_000_000;

const subscription = (
  id: string,
  status: string,
  over: Record<string, unknown> = {},
) => ({ id, status, start_date: SECONDS, ...over }) as never;

const schedule = (id: string, status: string) =>
  ({ id, status, phases: [{ start_date: SECONDS }] }) as never;

beforeEach(() => {
  state.rows = [];
  state.updates = [];
});

describe("recording a Deal's Stripe plan objects", () => {
  it("keeps an ended subscription when a replacement arrives", async () => {
    // Arrange — Jules Litman-Cleper: the first subscription was built with
    // four cycles against a six-payment agreement, so it ended; the
    // replacement carries the last two.
    await recordPlanObjects({
      dealId: 1,
      subscriptions: [subscription("sub_old", "active")],
      schedules: [],
    });

    // Act — the sweep now sees both.
    const delta = await recordPlanObjects({
      dealId: 1,
      subscriptions: [
        subscription("sub_old", "canceled", { canceled_at: SECONDS }),
        subscription("sub_new", "active"),
      ],
      schedules: [],
    });

    // Assert — two rows, not one replaced.
    expect(state.rows).toHaveLength(2);
    expect(delta.recorded).toBe(1);
    expect(delta.updated).toBe(1);
    expect(delta.currentSubscriptionId).toBe("sub_new");
    expect(
      state.rows.find((r) => r.stripe_object_id === "sub_old")?.status,
    ).toBe("canceled");
  });

  it("marks a completed schedule as no longer current without discarding it", async () => {
    // Arrange
    await recordPlanObjects({
      dealId: 1,
      subscriptions: [],
      schedules: [schedule("sched_1", "active")],
    });

    // Act
    const delta = await recordPlanObjects({
      dealId: 1,
      subscriptions: [],
      schedules: [schedule("sched_1", "completed")],
    });

    // Assert
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].is_current).toBe(false);
    expect(delta.currentScheduleId).toBeNull();
  });

  it("writes nothing on a second sweep over unchanged Stripe data", async () => {
    // Arrange
    const args = {
      dealId: 1,
      subscriptions: [subscription("sub_1", "active")],
      schedules: [schedule("sched_1", "active")],
    };
    await recordPlanObjects(args);
    state.updates = [];

    // Act
    const second = await recordPlanObjects(args);

    // Assert
    expect(second.recorded).toBe(0);
    expect(second.updated).toBe(0);
    expect(state.updates).toHaveLength(0);
  });

  it("reports a conflict rather than stealing an object owned elsewhere", async () => {
    // Arrange — the unique index means a Stripe object belongs to one
    // Deal. A second Deal claiming it is a real conflict for a human.
    state.rows.push({ stripe_object_id: "sub_taken", deal_id: 99 });

    // Act
    const delta = await recordPlanObjects({
      dealId: 1,
      subscriptions: [subscription("sub_taken", "active")],
      schedules: [],
    });

    // Assert — no silent overwrite. The row still belongs to deal 99.
    expect(delta.recorded).toBe(0);
    expect(state.rows[0].deal_id).toBe(99);
  });
});
