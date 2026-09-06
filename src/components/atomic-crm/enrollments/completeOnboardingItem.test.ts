import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { EnrollmentOnboardingItem, Task } from "../types";
import { completeOnboardingItem } from "./completeOnboardingItem";

const ENROLLMENT_ID = 1;
const ITEM_ID = 1;
const TASK_ID = 1;

const buildItem = (
  overrides: Partial<EnrollmentOnboardingItem> = {},
): EnrollmentOnboardingItem => ({
  id: ITEM_ID,
  enrollment_id: ENROLLMENT_ID,
  requirement_key: "contract",
  label: "Contract signed",
  task_text_template: "Send contract to {name}",
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
  type: "onboarding_item",
  text: "Send contract to Ada Lovelace",
  due_date: "2026-01-04T00:00:00.000Z",
  status: "pending",
  enrollment_id: ENROLLMENT_ID,
  onboarding_item_id: ITEM_ID,
  ...overrides,
});

const buildFixtures = (item = buildItem(), tasks: Task[] = [buildTask()]) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [buildContact({ id: 1 })],
      enrollments: [],
      enrollment_onboarding_items: [item],
      tasks,
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider };
};

describe("completeOnboardingItem", () => {
  it("marks the item done and completes its linked Task", async () => {
    const { dataProvider } = buildFixtures();

    const result = await completeOnboardingItem(dataProvider, ITEM_ID);
    expect(result.status).toBe("done");

    const { data: item } = await dataProvider.getOne<EnrollmentOnboardingItem>(
      "enrollment_onboarding_items",
      { id: ITEM_ID },
    );
    expect(item.status).toBe("done");
    expect(item.completed_at).toBeTruthy();

    const { data: task } = await dataProvider.getOne<Task>("tasks", {
      id: TASK_ID,
    });
    expect(task.status).toBe("completed");
    expect(task.done_date).toBeTruthy();
  });

  it("is idempotent — completing an already-done item is a safe no-op", async () => {
    const { dataProvider } = buildFixtures(
      buildItem({ status: "done", completed_at: "2026-01-02T00:00:00.000Z" }),
    );

    const result = await completeOnboardingItem(dataProvider, ITEM_ID);
    expect(result.status).toBe("already-done");
  });

  it("completing an item with no linked Task never throws — the checklist is the source of truth regardless", async () => {
    const { dataProvider } = buildFixtures(buildItem(), []);

    const result = await completeOnboardingItem(dataProvider, ITEM_ID);
    expect(result.status).toBe("done");
  });

  it("a cancelled Task is never resurrected/completed by completing its item", async () => {
    const { dataProvider } = buildFixtures(buildItem(), [
      buildTask({ status: "cancelled" }),
    ]);

    await completeOnboardingItem(dataProvider, ITEM_ID);

    const { data: task } = await dataProvider.getOne<Task>("tasks", {
      id: TASK_ID,
    });
    expect(task.status).toBe("cancelled");
    expect(task.done_date ?? null).toBeNull();
  });
});
