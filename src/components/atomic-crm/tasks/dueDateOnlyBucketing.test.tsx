import { ResourceContextProvider, ShowBase, useDataProvider } from "ra-core";
import type { DataProvider } from "ra-core";
import { render } from "vitest-browser-react";
import { commands } from "vitest/browser";

import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { getDenverDateString } from "../dashboard/artOracle/selectDailyArtwork";
import { AddTask } from "./AddTask";
import { isDueLater, isDueToday, isOverdue } from "./tasksPredicate";

// Manual Task UX repair, round 2 (§4): proves the date-only create form
// still buckets correctly under Denver-local semantics — the exact thing
// a naive "just store the bare date string" implementation would get
// wrong (see dateOnlyToTimestamp.ts's own header comment: a bare date
// parses as UTC midnight, which is the PREVIOUS calendar day west of
// UTC). Forces the browser's own runtime timezone to America/Denver via
// CDP (same technique as postponeTaskDate.test.ts) so
// tasksPredicate.ts's startOfToday()/endOfToday() (which read whatever
// timezone the runtime is actually in) and getDenverDateString() (which
// always computes Denver explicitly) are proven to agree.
describe("Manual Task due date — Denver-local bucketing (Manual Task UX repair, round 2)", () => {
  let originalTimezone: string;

  beforeEach(() => {
    originalTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  afterEach(async () => {
    await commands.setTimezone(originalTimezone);
  });

  const renderAddTask = async () => {
    const contact = buildContact({
      id: 1,
      first_name: "Maya",
      last_name: "Chen",
    });
    let dataProvider: DataProvider | null = null;
    const DataProviderListener = () => {
      dataProvider = useDataProvider();
      return null;
    };

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <DataProviderListener />
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <AddTask />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    return { screen, getDataProvider: () => dataProvider! };
  };

  it("R: a date picked as today buckets as Today, not Overdue", async () => {
    await commands.setTimezone("America/Denver");
    const { screen, getDataProvider } = await renderAddTask();

    await screen.getByRole("button", { name: "Add task" }).click();
    // Waits for the Contact to resolve off record context before typing
    // — otherwise the Save click could land before contact_id is known
    // (a test-setup race, not the thing under test — same fix as
    // AddTask.test.tsx's own §L).
    await expect
      .element(screen.getByText("Create task for Maya Chen"))
      .toBeVisible();
    await screen
      .getByRole("textbox")
      .first()
      .fill("Check in about GYU attendance");

    const today = getDenverDateString();
    const dueDateInput = screen.getByLabelText(/due date/i);
    await dueDateInput.fill(today);
    await screen.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(async () => {
        const { data } = await getDataProvider().getList("tasks", {
          filter: { contact_id: 1 },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
        });
        return data.length;
      })
      .toBe(1);

    const { data: tasks } = await getDataProvider().getList("tasks", {
      filter: { contact_id: 1 },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    const created = tasks[0];

    expect(isDueToday(created.due_date)).toBe(true);
    expect(isOverdue(created.due_date)).toBe(false);
  });

  it("S: a date ten days out buckets as Later, not Today or Overdue", async () => {
    await commands.setTimezone("America/Denver");
    const { screen, getDataProvider } = await renderAddTask();

    await screen.getByRole("button", { name: "Add task" }).click();
    await expect
      .element(screen.getByText("Create task for Maya Chen"))
      .toBeVisible();
    await screen.getByRole("textbox").first().fill("Follow up in ten days");

    const [year, month, day] = getDenverDateString().split("-").map(Number);
    const future = new Date(year!, month! - 1, day! + 10);
    const futureDenverDate = [
      future.getFullYear(),
      String(future.getMonth() + 1).padStart(2, "0"),
      String(future.getDate()).padStart(2, "0"),
    ].join("-");

    const dueDateInput = screen.getByLabelText(/due date/i);
    await dueDateInput.fill(futureDenverDate);
    await screen.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(async () => {
        const { data } = await getDataProvider().getList("tasks", {
          filter: { contact_id: 1 },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
        });
        return data.length;
      })
      .toBe(1);

    const { data: tasks } = await getDataProvider().getList("tasks", {
      filter: { contact_id: 1 },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    const created = tasks[0];

    expect(isDueToday(created.due_date)).toBe(false);
    expect(isOverdue(created.due_date)).toBe(false);
    expect(isDueLater(created.due_date)).toBe(true);
  });

  // T: a SYSTEM-generated Task's own pre-existing due_date (a real
  // timestamp with a specific time-of-day, exactly the shape
  // onboarding_item/resolve_sales_call Tasks already carry) is untouched
  // by this repair — tasksPredicate.ts itself was never modified, and
  // nothing here ever re-parses or re-writes a Task's due_date unless
  // Leif actually re-saves it through the form.
  it("T: an existing system-generated Task's precise due_date still buckets exactly as before", async () => {
    await commands.setTimezone("America/Denver");
    // A real timestamp WITH a specific time-of-day — exactly the shape
    // an onboarding_item/resolve_sales_call Task's due_date already had
    // before this repair, and never re-parsed or rewritten by it (this
    // form change only affects a due_date the moment Leif actually
    // re-saves it through this form — an untouched row is untouched).
    const today = getDenverDateString();
    const [year, month, day] = today.split("-").map(Number);
    const preciseToday = new Date(
      year!,
      month! - 1,
      day!,
      13,
      40,
      0,
    ).toISOString();

    expect(isDueToday(preciseToday)).toBe(true);
    expect(isOverdue(preciseToday)).toBe(false);

    const overduePrecise = "2020-01-01T13:40:00.000Z";
    expect(isOverdue(overduePrecise)).toBe(true);
    expect(isDueToday(overduePrecise)).toBe(false);
  });
});
