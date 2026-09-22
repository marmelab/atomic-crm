import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";

import { CRM } from "../root/CRM";
import { testI18nProvider } from "../providers/commons/i18nProvider";
import { createDataProvider } from "../providers/fakerest";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import type { Cohort, Deal, Enrollment, Offer } from "../types";

// Creating and editing a Program, driven the way Leif drives it.
//
// The rule under test is the type distinction, and it is only really
// testable here: a group program is set up as a program plus a ROUND with
// shared dates, while a 1:1 program is set up as a program and nothing
// else, because its clients do not share a start or a finish. The forms
// have to embody that, not merely be documented as doing so.

const individualProgram: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  max_active_clients: 12,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const groupProgram: Offer = {
  id: 2,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const fallCohort: Cohort = {
  id: 3,
  offer_id: 2,
  name: "Growing Yourself Up — Fall 2026",
  status: "applications_open",
  program_start_at: "2026-09-22",
  program_end_at: "2026-11-10",
  duration_value: 8,
  duration_unit: "weeks",
  minimum_capacity: 5,
  target_capacity: 10,
  maximum_capacity: 10,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildDb = () => {
  const contacts = Array.from({ length: 3 }, (_, i) =>
    buildContact({ id: i + 1, first_name: `Member${i + 1}`, last_name: "Gyu" }),
  );
  const deals: Deal[] = contacts.map((contact, i) => ({
    id: i + 1,
    name: `Member${i + 1}`,
    contact_id: contact.id,
    offer_id: 2,
    cohort_id: 3,
    stage: "won",
    outcome: null,
    amount: 1400,
    sales_id: 0,
    index: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    stage_entered_at: "2026-01-01T00:00:00.000Z",
  }));
  const enrollments: Enrollment[] = deals.map((deal, i) => ({
    id: i + 1,
    opportunity_id: deal.id,
    onboarding_tracking: "tracked" as const,
    status: "active",
    start_date: "2026-09-22",
    end_date: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }));

  return createCrmDb({
    contacts,
    offers: [individualProgram, groupProgram],
    cohorts: [fallCohort],
    deals,
    enrollments,
    // Two people waiting on the Fall round — the relationship a save
    // must leave alone.
    waitlist_entries: [
      {
        id: 1,
        contact_id: 1,
        offer_id: 2,
        cohort_id: 3,
        status: "waiting",
        joined_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        contact_id: 2,
        offer_id: 2,
        cohort_id: 3,
        status: "waiting",
        joined_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    applications: [],
    waitlist_invitation_batches: [],
    tasks: [],
  } as any);
};

const mountAt = async (path: string) => {
  const db = buildDb();
  const dataProvider = createDataProvider({ db, silent: true, latency: 0 });
  const screen = await render(
    <MemoryRouter initialEntries={[path]}>
      <CRM
        dataProvider={dataProvider}
        authProvider={createTestAuthProvider()}
        i18nProvider={testI18nProvider}
        store={memoryStore()}
        disableTelemetry
      />
    </MemoryRouter>,
  );
  return { screen, dataProvider };
};

const countIn = async (
  dataProvider: ReturnType<typeof createDataProvider>,
  resource: string,
  filter: Record<string, unknown>,
) => {
  const { total } = await dataProvider.getList(resource, {
    filter,
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });
  return total ?? 0;
};

describe("setting up a new Program", () => {
  it("asks a group program for its first round's shared dates", async () => {
    // A group program IS a sequence of rounds, and a round without dates
    // is not yet a thing anybody can be enrolled in. So the second step
    // is the round, and it carries the shared schedule.
    const { screen } = await mountAt("/programs");

    await screen.getByRole("button", { name: "New Program" }).click();
    await screen.getByRole("button", { name: /Group Program/ }).click();

    // Step one is the program itself. No round dates here — the program
    // outlives every round it runs.
    await expect.element(screen.getByLabelText(/^Name/i)).toBeVisible();
    expect(screen.container.ownerDocument.body.textContent).not.toContain(
      "Program start",
    );

    await screen.getByLabelText(/^Name/i).fill("Group Program Two");
    await screen.getByLabelText(/^Duration/i).fill("6 weeks");
    await screen.getByLabelText(/Price/i).fill("900");
    await screen.getByRole("button", { name: "Create Offer" }).click();

    // Step two: the first round, with the schedule.
    await expect.element(screen.getByLabelText(/Program start/i)).toBeVisible();
    await expect.element(screen.getByLabelText(/Program end/i)).toBeVisible();
    await expect.element(screen.getByLabelText(/^Duration/i)).toBeVisible();
  });

  it("derives the round's end date in the create flow", async () => {
    // The Fall 2026 numbers, entered from scratch: 22 September plus 8
    // weeks. The eighth weekly session begins seven weeks after the
    // first, so the round ends on 10 November — never 17 November.
    const { screen } = await mountAt("/programs");

    await screen.getByRole("button", { name: "New Program" }).click();
    await screen.getByRole("button", { name: /Group Program/ }).click();
    await screen.getByLabelText(/^Name/i).fill("Group Program Two");
    await screen.getByLabelText(/^Duration/i).fill("8 weeks");
    await screen.getByLabelText(/Price/i).fill("1400");
    await screen.getByRole("button", { name: "Create Offer" }).click();

    await expect.element(screen.getByLabelText(/Program start/i)).toBeVisible();
    await screen.getByLabelText(/Program start/i).fill("2026-09-22");
    await screen.getByLabelText(/^Duration/i).fill("8");

    await expect
      .poll(
        async () =>
          (
            (await screen
              .getByLabelText(/Program end/i)
              .element()) as HTMLInputElement
          ).value,
      )
      .toBe("2026-11-10");
  });

  it("sets a 1:1 program up with no round and no shared dates", async () => {
    // Each 1:1 client has their own Start Week and their own finish, from
    // the Year Tracking calendar. A shared round would be fiction, so
    // there is no second step to reach.
    const { screen } = await mountAt("/programs");

    await screen.getByRole("button", { name: "New Program" }).click();
    await screen.getByRole("button", { name: /1:1 Program/ }).click();

    // A 1:1 program has the thing a group program does not: a ceiling on
    // how many people can be in it at once.
    await expect
      .element(screen.getByLabelText(/Max active clients/i))
      .toBeVisible();

    await screen.getByLabelText(/^Name/i).fill("A Second 1:1 Program");
    await screen.getByLabelText(/^Duration/i).fill("4 months");
    await screen.getByLabelText(/Price/i).fill("4000");
    await screen.getByRole("button", { name: "Create Offer" }).click();

    // The dialog is done. No round step appeared.
    await expect
      .poll(() => screen.container.ownerDocument.body.textContent)
      .not.toContain("Program start");
  });
});

describe("editing a Program", () => {
  it("opens a round's edit form already filled in", async () => {
    const { screen } = await mountAt("/cohorts/3");

    await expect
      .poll(
        async () =>
          (
            (await screen
              .getByLabelText(/Program start/i)
              .element()) as HTMLInputElement
          ).value,
      )
      .toBe("2026-09-22");
    expect(
      (
        (await screen
          .getByLabelText(/Program end/i)
          .element()) as HTMLInputElement
      ).value,
    ).toBe("2026-11-10");
    expect(
      (
        (await screen
          .getByLabelText(/^Duration/i)
          .element()) as HTMLInputElement
      ).value,
    ).toBe("8");
  });

  it("keeps everyone attached to the round when it is saved", async () => {
    // Moving a round's dates is an ordinary thing to do — a week's
    // holiday, a late start. It must not disturb who is in it or who is
    // waiting for it.
    const { screen, dataProvider } = await mountAt("/cohorts/3");

    await expect
      .poll(
        async () =>
          (
            (await screen
              .getByLabelText(/Program start/i)
              .element()) as HTMLInputElement
          ).value,
      )
      .toBe("2026-09-22");

    await screen.getByLabelText(/Program start/i).fill("2026-09-29");
    await screen.getByRole("button", { name: /Save/i }).click();

    // The round now reads the way Leif left it.
    await expect.element(screen.getByText("Sep 29, 2026")).toBeVisible();

    // Saving is undoable, so the write is held behind the toast until the
    // undo window closes. Dismissing it is what a person does, and it is
    // what sends the update — polling the data provider without this only
    // ever proves the optimistic render.
    await screen.getByLabelText("Close toast").first().click();

    await expect
      .poll(async () => {
        const { data } = await dataProvider.getOne("cohorts", { id: 3 });
        return data.program_start_at;
      })
      .toBe("2026-09-29");

    expect(await countIn(dataProvider, "deals", { cohort_id: 3 })).toBe(3);
    expect(
      await countIn(dataProvider, "waitlist_entries", { cohort_id: 3 }),
    ).toBe(2);
    expect(await countIn(dataProvider, "enrollments", {})).toBe(3);
  });

  it("opens a 1:1 program's edit form with no round scheduling on it", async () => {
    const { screen } = await mountAt("/offers/1");

    await expect
      .poll(
        async () =>
          (
            (await screen
              .getByLabelText(/^Name/i)
              .element()) as HTMLInputElement
          ).value,
      )
      .toBe("The Living Example");
    const text = screen.container.ownerDocument.body.textContent ?? "";
    expect(text).not.toContain("Program start");
    expect(text).not.toContain("Program end");
  });
});
