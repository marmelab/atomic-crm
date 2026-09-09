import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { EnrollmentOffboardingItem, Task } from "../types";

// Client Offboarding slice: the Task -> item half of the two-way sync
// (§7), mirroring sync_offboarding_item_from_task() exactly — the SAME
// direction completeOnboardingItem.test.ts's own sibling suite doesn't
// separately unit-test either, but is architecturally important enough
// (§7 explicitly calls out the sync) to prove directly at the
// dataProvider level: a Task's own done_date checkbox (checked from the
// Contact page/Dashboard/anywhere else a Task surfaces, not just the
// Offboarding checklist) still keeps the checklist item in sync.
const ENROLLMENT_ID = 1;
const ITEM_ID = 1;
const TASK_ID = 1;

const buildItem = (
  overrides: Partial<EnrollmentOffboardingItem> = {},
): EnrollmentOffboardingItem => ({
  id: ITEM_ID,
  enrollment_id: ENROLLMENT_ID,
  requirement_key: "notes_archived",
  label: "Session notes archived",
  task_text_template: "Move {name}'s session notes to Past Clients",
  is_required: true,
  sort_order: 1,
  status: "pending",
  completed_at: null,
  external_ref: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: TASK_ID,
  contact_id: 1,
  type: "offboarding_item",
  text: "Move Ada Lovelace's session notes to Past Clients",
  due_date: "2026-01-04T00:00:00.000Z",
  status: "pending",
  enrollment_id: ENROLLMENT_ID,
  offboarding_item_id: ITEM_ID,
  ...overrides,
});

const buildFixtures = (item = buildItem(), task = buildTask()) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: 1 })],
      enrollments: [],
      enrollment_offboarding_items: [item],
      tasks: [task],
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider };
};

describe("offboarding Task -> item sync (sync_offboarding_item_from_task() FakeRest mirror)", () => {
  it("checking a Task's done_date (e.g. from the Contact page) marks its linked offboarding item done", async () => {
    const { dataProvider } = buildFixtures();
    const { data: task } = await dataProvider.getOne<Task>("tasks", {
      id: TASK_ID,
    });

    await dataProvider.update("tasks", {
      id: TASK_ID,
      data: { done_date: "2026-01-05T00:00:00.000Z", status: "completed" },
      previousData: task,
    });

    const { data: item } = await dataProvider.getOne<EnrollmentOffboardingItem>(
      "enrollment_offboarding_items",
      { id: ITEM_ID },
    );
    expect(item.status).toBe("done");
    expect(item.completed_at).toBeTruthy();
  });

  it("unchecking a Task's done_date reopens its linked offboarding item to pending", async () => {
    const { dataProvider } = buildFixtures(
      buildItem({ status: "done", completed_at: "2026-01-02T00:00:00.000Z" }),
      buildTask({ status: "completed", done_date: "2026-01-02T00:00:00.000Z" }),
    );
    const { data: task } = await dataProvider.getOne<Task>("tasks", {
      id: TASK_ID,
    });

    await dataProvider.update("tasks", {
      id: TASK_ID,
      data: { done_date: null, status: "pending" },
      previousData: task,
    });

    const { data: item } = await dataProvider.getOne<EnrollmentOffboardingItem>(
      "enrollment_offboarding_items",
      { id: ITEM_ID },
    );
    expect(item.status).toBe("pending");
    expect(item.completed_at ?? null).toBeNull();
  });

  it("cancelling a Task (no done_date change) never touches its linked offboarding item — the checklist stays the durable source of truth", async () => {
    const { dataProvider } = buildFixtures();
    const { data: task } = await dataProvider.getOne<Task>("tasks", {
      id: TASK_ID,
    });

    await dataProvider.update("tasks", {
      id: TASK_ID,
      data: { status: "cancelled" },
      previousData: task,
    });

    const { data: item } = await dataProvider.getOne<EnrollmentOffboardingItem>(
      "enrollment_offboarding_items",
      { id: ITEM_ID },
    );
    expect(item.status).toBe("pending");
  });
});
