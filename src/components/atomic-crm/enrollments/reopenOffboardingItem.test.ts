import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type {
  Deal,
  Enrollment,
  EnrollmentOffboardingItem,
  Task,
} from "../types";
import { reopenOffboardingItem } from "./reopenOffboardingItem";

const ENROLLMENT_ID = 1;
const ITEM_ID = 1;
const TASK_ID = 1;
const DEAL_ID = 1;

const buildDeal = (): Deal => ({
  pricing_mode: "standard",
  id: DEAL_ID,
  name: "Ada Lovelace",
  contact_id: 1,
  offer_id: 1,
  stage: "won",
  outcome: null,
  amount: 4000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
});

const buildEnrollment = (): Enrollment => ({
  id: ENROLLMENT_ID,
  opportunity_id: DEAL_ID,
  status: "offboarding",
  start_date: "2026-01-01",
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

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
  status: "done",
  completed_at: "2026-01-02T00:00:00.000Z",
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
  status: "completed",
  done_date: "2026-01-02T00:00:00.000Z",
  enrollment_id: ENROLLMENT_ID,
  offboarding_item_id: ITEM_ID,
  ...overrides,
});

const buildFixtures = (item = buildItem(), tasks: Task[] = [buildTask()]) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      deals: [buildDeal()],
      enrollments: [buildEnrollment()],
      enrollment_offboarding_items: [item],
      tasks,
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider };
};

describe("reopenOffboardingItem", () => {
  it("reopens the item to pending and reopens its SAME completed Task", async () => {
    const { dataProvider } = buildFixtures();

    const result = await reopenOffboardingItem(dataProvider, ITEM_ID);
    expect(result.status).toBe("reopened");

    const { data: item } = await dataProvider.getOne<EnrollmentOffboardingItem>(
      "enrollment_offboarding_items",
      { id: ITEM_ID },
    );
    expect(item.status).toBe("pending");
    expect(item.completed_at).toBeNull();

    const { data: task } = await dataProvider.getOne<Task>("tasks", {
      id: TASK_ID,
    });
    expect(task.status).toBe("pending");
    expect(task.done_date ?? null).toBeNull();
  });

  it("is idempotent — reopening an already-pending item is a safe no-op", async () => {
    const { dataProvider } = buildFixtures(buildItem({ status: "pending" }));

    const result = await reopenOffboardingItem(dataProvider, ITEM_ID);
    expect(result.status).toBe("already-pending");
  });

  it("when the linked Task was cancelled (not completed), reopening creates a FRESH Task rather than resurrecting the cancelled one", async () => {
    const { dataProvider } = buildFixtures(buildItem(), [
      buildTask({ status: "cancelled", done_date: null }),
    ]);

    await reopenOffboardingItem(dataProvider, ITEM_ID);

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: { offboarding_item_id: ITEM_ID },
    });
    expect(tasks).toHaveLength(2);
    const cancelled = tasks.find((task) => task.status === "cancelled");
    const fresh = tasks.find((task) => task.id !== cancelled?.id);
    expect(cancelled?.done_date ?? null).toBeNull();
    expect(fresh?.status).toBe("pending");
    expect(fresh?.text).toBe(
      "Move Ada Lovelace's session notes to Past Clients",
    );
    expect(fresh?.enrollment_id).toBe(ENROLLMENT_ID);
  });
});
