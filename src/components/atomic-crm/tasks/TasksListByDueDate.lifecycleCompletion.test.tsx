import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { CoreAdminContext } from "ra-core";

import { Notification } from "@/components/admin/notification";
import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import { testI18nProvider } from "../providers/commons/i18nProvider";
import type {
  EnrollmentOffboardingItem,
  EnrollmentOnboardingItem,
  Task,
} from "../types";
import { TasksListByDueDate } from "./TasksListByDueDate";

// Human-acceptance repair, lifecycle-Task completion durability fix:
// reproduces the exact failure Leif hit — two lifecycle-linked Tasks
// checked complete, both visually crossed out, then ~4 seconds later
// BOTH reverted to unchecked. Root cause: the checkbox routed completion
// through react-admin's undoable `useUpdate` (a second, independently-
// mutated, client-side-only copy of what the checklist item already
// owns) instead of the authoritative, synchronous checklist-item
// completion path. Fixed in Task.tsx; these tests prove the durable
// invariant across the exact sequence that broke: check -> brief
// confirmation window -> beyond that window -> a fresh read.
const CONTACT_ID = 1;
const ENROLLMENT_ID = 1;
const ONBOARDING_ITEM_ID = 1;
const OFFBOARDING_ITEM_ID = 1;
const ONBOARDING_TASK_ID = 1;
const OFFBOARDING_TASK_ID = 2;

const buildOnboardingItem = (
  overrides: Partial<EnrollmentOnboardingItem> = {},
): EnrollmentOnboardingItem => ({
  id: ONBOARDING_ITEM_ID,
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

const buildOffboardingItem = (
  overrides: Partial<EnrollmentOffboardingItem> = {},
): EnrollmentOffboardingItem => ({
  id: OFFBOARDING_ITEM_ID,
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

const buildOnboardingTask = (overrides: Partial<Task> = {}): Task => ({
  id: ONBOARDING_TASK_ID,
  contact_id: CONTACT_ID,
  type: "onboarding_item",
  text: "Send contract to Ada Lovelace",
  due_date: "2026-01-01T09:00:00.000Z",
  status: "pending",
  enrollment_id: ENROLLMENT_ID,
  onboarding_item_id: ONBOARDING_ITEM_ID,
  ...overrides,
});

const buildOffboardingTask = (overrides: Partial<Task> = {}): Task => ({
  id: OFFBOARDING_TASK_ID,
  contact_id: CONTACT_ID,
  type: "offboarding_item",
  text: "Move Ada Lovelace's session notes to Past Clients",
  due_date: "2026-01-01T09:00:00.000Z",
  status: "pending",
  enrollment_id: ENROLLMENT_ID,
  offboarding_item_id: OFFBOARDING_ITEM_ID,
  ...overrides,
});

const buildFixtures = () => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({
          id: CONTACT_ID,
          first_name: "Ada",
          last_name: "Lovelace",
        }),
      ],
      enrollments: [],
      enrollment_onboarding_items: [buildOnboardingItem()],
      enrollment_offboarding_items: [buildOffboardingItem()],
      tasks: [buildOnboardingTask(), buildOffboardingTask()],
    } as any),
    silent: true,
  });
  return { dataProvider };
};

const renderList = (dataProvider: ReturnType<typeof createDataProvider>) =>
  render(
    <CoreAdminContext
      dataProvider={dataProvider}
      i18nProvider={testI18nProvider}
    >
      <TasksListByDueDate filterByContact={CONTACT_ID} />
      <Notification />
    </CoreAdminContext>,
  );

describe("lifecycle-linked Task completion is durable (human-acceptance repair)", () => {
  it("completing an onboarding-linked Task via its checkbox persists through the confirmation window and a fresh read — never reverts to unchecked", async () => {
    const { dataProvider } = buildFixtures();
    const screen = await renderList(dataProvider);

    await expect
      .element(screen.getByText("Send contract to Ada Lovelace"))
      .toBeVisible();

    // Before: both the Task and the item are genuinely pending.
    const { data: before } = await dataProvider.getOne("tasks", {
      id: ONBOARDING_TASK_ID,
    });
    expect(before.status).toBe("pending");

    await screen.getByRole("checkbox").nth(0).click();

    // Immediately after: real, persisted completion — not merely an
    // optimistic client-side patch.
    await expect
      .poll(async () => {
        const { data } = await dataProvider.getOne("tasks", {
          id: ONBOARDING_TASK_ID,
        });
        return data.status;
      })
      .toBe("completed");
    const { data: itemRightAfter } =
      await dataProvider.getOne<EnrollmentOnboardingItem>(
        "enrollment_onboarding_items",
        { id: ONBOARDING_ITEM_ID },
      );
    expect(itemRightAfter.status).toBe("done");

    // Past the brief confirmation window: the row leaves the active list
    // (this is the purely-presentational part, unchanged)...
    await expect
      .element(screen.getByText("Send contract to Ada Lovelace"), {
        timeout: 5000,
      })
      .not.toBeVisible();

    // ...but the underlying state must NOT have reverted — this is
    // exactly where Leif's human-acceptance pass found it snapping back
    // to unchecked/pending.
    const { data: taskAfterWindow } = await dataProvider.getOne("tasks", {
      id: ONBOARDING_TASK_ID,
    });
    expect(taskAfterWindow.status).toBe("completed");
    expect(taskAfterWindow.done_date).toBeTruthy();
    const { data: itemAfterWindow } =
      await dataProvider.getOne<EnrollmentOnboardingItem>(
        "enrollment_onboarding_items",
        { id: ONBOARDING_ITEM_ID },
      );
    expect(itemAfterWindow.status).toBe("done");

    // A completely fresh read (a new getList call, the closest this
    // harness gets to "reload the page") still shows it completed.
    const { data: freshList } = await dataProvider.getList("tasks", {
      filter: { id: ONBOARDING_TASK_ID },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    expect(freshList[0].status).toBe("completed");
  });

  it("completing an offboarding-linked Task via its checkbox persists through the confirmation window and a fresh read — never reverts to unchecked", async () => {
    const { dataProvider } = buildFixtures();
    const screen = await renderList(dataProvider);

    await expect
      .element(
        screen.getByText("Move Ada Lovelace's session notes to Past Clients"),
      )
      .toBeVisible();

    await screen.getByRole("checkbox").nth(1).click();

    await expect
      .poll(async () => {
        const { data } = await dataProvider.getOne("tasks", {
          id: OFFBOARDING_TASK_ID,
        });
        return data.status;
      })
      .toBe("completed");

    await expect
      .element(
        screen.getByText("Move Ada Lovelace's session notes to Past Clients"),
        { timeout: 5000 },
      )
      .not.toBeVisible();

    const { data: taskAfterWindow } = await dataProvider.getOne("tasks", {
      id: OFFBOARDING_TASK_ID,
    });
    expect(taskAfterWindow.status).toBe("completed");
    const { data: itemAfterWindow } =
      await dataProvider.getOne<EnrollmentOffboardingItem>(
        "enrollment_offboarding_items",
        { id: OFFBOARDING_ITEM_ID },
      );
    expect(itemAfterWindow.status).toBe("done");
  });

  it("checking BOTH lifecycle Tasks in quick succession — the exact human-acceptance sequence — leaves both durably completed, neither reverts", async () => {
    const { dataProvider } = buildFixtures();
    const screen = await renderList(dataProvider);

    await expect
      .element(screen.getByText("Send contract to Ada Lovelace"))
      .toBeVisible();

    // Both checked back-to-back, no await in between the clicks
    // themselves — this is exactly the "two lifecycle Tasks checked in
    // quick succession" sequence that raced before.
    const checkboxes = screen.getByRole("checkbox");
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();

    await expect
      .poll(async () => {
        const [{ data: t1 }, { data: t2 }] = await Promise.all([
          dataProvider.getOne("tasks", { id: ONBOARDING_TASK_ID }),
          dataProvider.getOne("tasks", { id: OFFBOARDING_TASK_ID }),
        ]);
        return t1.status === "completed" && t2.status === "completed";
      })
      .toBe(true);

    // Wait well past the confirmation window (and past the ~5s window
    // human acceptance observed the revert in) — both moved into history,
    // proven by the collapsed disclosure's own count rather than probing
    // for one specific row's visibility (once genuinely moved into
    // history the row may no longer exist in the DOM at all, which some
    // visibility matchers can't distinguish from "still there but
    // hidden" — the durable data state below is the real invariant).
    await expect
      .element(screen.getByText("Completed tasks (2)"), { timeout: 6000 })
      .toBeVisible();

    const [{ data: t1Final }, { data: t2Final }] = await Promise.all([
      dataProvider.getOne("tasks", { id: ONBOARDING_TASK_ID }),
      dataProvider.getOne("tasks", { id: OFFBOARDING_TASK_ID }),
    ]);
    expect(t1Final.status).toBe("completed");
    expect(t2Final.status).toBe("completed");

    const [{ data: item1Final }, { data: item2Final }] = await Promise.all([
      dataProvider.getOne<EnrollmentOnboardingItem>(
        "enrollment_onboarding_items",
        { id: ONBOARDING_ITEM_ID },
      ),
      dataProvider.getOne<EnrollmentOffboardingItem>(
        "enrollment_offboarding_items",
        { id: OFFBOARDING_ITEM_ID },
      ),
    ]);
    expect(item1Final.status).toBe("done");
    expect(item2Final.status).toBe("done");
  });

  it("completing via the checklist item still completes its linked Task durably (the reverse direction)", async () => {
    const { dataProvider } = buildFixtures();

    // Exercises the ITEM -> Task direction directly, the same function
    // ClientShow's own checklist checkbox calls.
    const { completeOffboardingItem } = await import(
      "../enrollments/completeOffboardingItem"
    );
    await completeOffboardingItem(dataProvider, OFFBOARDING_ITEM_ID);

    const { data: item } = await dataProvider.getOne<EnrollmentOffboardingItem>(
      "enrollment_offboarding_items",
      { id: OFFBOARDING_ITEM_ID },
    );
    expect(item.status).toBe("done");
    const { data: task } = await dataProvider.getOne("tasks", {
      id: OFFBOARDING_TASK_ID,
    });
    expect(task.status).toBe("completed");
    expect(task.done_date).toBeTruthy();
  });
});
