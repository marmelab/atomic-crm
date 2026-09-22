import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { memoryStore, type DataProvider } from "ra-core";
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
import { offerDeleteSafety } from "./programDeleteSafety";

// The Programs hub, as Leif uses it.
//
// Two program TYPES, two sets of rules, and the point of these tests is
// that the rules follow the type and not the name. The Living Example is
// only the current 1:1 program and Growing Yourself Up only the current
// group one; a second of either must behave the same way on the day it is
// created.

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

// The real Fall 2026 round: owner-confirmed dates, 10 seats, 7 enrolled.
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

// January 2027: fifty-one people waiting, nothing scheduled.
const januaryCohort: Cohort = {
  id: 4,
  offer_id: 2,
  name: "Growing Yourself Up — January 2027",
  status: "draft",
  program_start_at: null,
  program_end_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildTestCrm = () => {
  // Seven enrolled in Fall 2026.
  const contacts = Array.from({ length: 7 }, (_, i) =>
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

  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts,
      offers: [individualProgram, groupProgram],
      cohorts: [fallCohort, januaryCohort],
      deals,
      enrollments,
      waitlist_entries: [],
      // Present and empty, as in production. An unknown count is treated
      // as blocking on purpose (programDeleteSafety.ts) — "we could not
      // check" must never read as "safe to delete" — so the fixture has
      // to be honest about which tables exist.
      applications: [],
      waitlist_invitation_batches: [],
      tasks: [],
    } as any),
    silent: true,
    latency: 0,
  });

  return (
    <MemoryRouter initialEntries={["/programs"]}>
      <CRM
        dataProvider={dataProvider}
        authProvider={createTestAuthProvider()}
        i18nProvider={testI18nProvider}
        store={memoryStore()}
        disableTelemetry
      />
    </MemoryRouter>
  );
};

describe("the Programs hub", () => {
  it("shows a group round's shared dates, seats and enrolled count", async () => {
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByText("Growing Yourself Up — Fall 2026"))
      .toBeVisible();
    // Sep 22 through Nov 10 — the owner-confirmed range, not Nov 17.
    await expect.element(screen.getByText("Sep 22 – Nov 10")).toBeVisible();

    const text = screen.container.textContent ?? "";
    expect(text).toContain("7");
    expect(text).toContain("/ 10");
    expect(text).toContain("3 seats left");
  });

  it("says a round has no dates rather than inventing them", async () => {
    // January 2027 has fifty-one people waiting and nothing scheduled.
    // Leif enters those dates when he knows them; the CRM does not guess.
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByText("Growing Yourself Up — January 2027"))
      .toBeVisible();
    await expect
      .element(screen.getByText("Dates not set yet").first())
      .toBeVisible();
  });

  it("shows no shared date range on a 1:1 program", async () => {
    // Each 1:1 client has their own Start Week and their own finish. One
    // range across all of them would be fiction.
    const screen = await render(buildTestCrm());

    await expect.element(screen.getByText("The Living Example")).toBeVisible();
    // Scoped to the 1:1 section — the group cards further down DO carry a
    // range, and asserting over the whole page would only prove the page
    // has one somewhere.
    const page = screen.container.textContent ?? "";
    const oneToOne = page.slice(
      page.indexOf("1:1 Programs"),
      page.indexOf("Group Programs"),
    );
    expect(oneToOne).toContain("The Living Example");
    expect(oneToOne).not.toContain("–");
    expect(oneToOne).not.toContain("Dates not set yet");
  });

  it("puts a three-dot menu on every program card", async () => {
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByText("Growing Yourself Up — Fall 2026"))
      .toBeVisible();
    // One per card: the 1:1 program and both rounds.
    const menus = screen.getByRole("button", { name: "Program actions" });
    expect(await menus.all()).toHaveLength(3);
  });

  it("offers Edit, Archive and Delete", async () => {
    const screen = await render(buildTestCrm());
    await expect
      .element(screen.getByText("Growing Yourself Up — Fall 2026"))
      .toBeVisible();

    await screen
      .getByRole("button", { name: "Program actions" })
      .first()
      .click();

    await expect
      .element(screen.getByRole("menuitem", { name: "Edit program" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("menuitem", { name: "Archive program" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("menuitem", { name: "Delete program" }))
      .toBeVisible();
  });

  it("refuses to delete a round that has people, and offers Archive instead", async () => {
    // Fall 2026 has seven Opportunities behind it. The database refuses
    // this too (20260921180000), and deliberately so — but Leif meets
    // this layer first, and what he needs here is what is linked and a
    // way forward, not a foreign-key violation.
    const screen = await render(buildTestCrm());
    await expect
      .element(screen.getByText("Growing Yourself Up — Fall 2026"))
      .toBeVisible();

    const menus = await screen
      .getByRole("button", { name: "Program actions" })
      .all();
    // The Fall round's own menu — the group section follows the 1:1 one.
    await menus[1]!.click();
    await screen.getByRole("menuitem", { name: "Delete program" }).click();

    await expect
      .element(screen.getByText("Growing Yourself Up — Fall 2026 has history"))
      .toBeVisible();
    const text = screen.container.ownerDocument.body.textContent ?? "";
    expect(text).toContain("7 Opportunities");
    expect(text).toContain("archive it instead");
  });

  it("offers a plain confirmation for a round nothing is linked to", async () => {
    // January 2027 in this fixture has no Opportunities, Applications or
    // waitlist rows — an empty round is disposable.
    const screen = await render(buildTestCrm());
    await expect
      .element(screen.getByText("Growing Yourself Up — January 2027"))
      .toBeVisible();

    const menus = await screen
      .getByRole("button", { name: "Program actions" })
      .all();
    await menus[2]!.click();
    await screen.getByRole("menuitem", { name: "Delete program" }).click();

    await expect
      .element(screen.getByText("Delete Growing Yourself Up — January 2027?"))
      .toBeVisible();
    expect(screen.container.ownerDocument.body.textContent).toContain(
      "Nothing is linked to it",
    );
  });
});

describe("a 1:1 program's openings on the hub", () => {
  it("never prints the answer where a count belongs", async () => {
    // Openings stopped being a number when they became a ledger answer,
    // and both program cards went on interpolating the answer OBJECT into
    // "%{count} openings" — so the dashboard and this hub each read
    // "[object Object] openings" until something rendered them.
    //
    // This fixture has no Year Tracking weeks, which is the case that
    // matters most: with no calendar the CRM cannot say whether anybody
    // could start, and that must read as not knowing, never as a number
    // and never as zero.
    const screen = await render(buildTestCrm());

    await expect.element(screen.getByText("The Living Example")).toBeVisible();
    const text = screen.container.ownerDocument.body.textContent ?? "";
    expect(text).not.toContain("[object Object]");
    expect(text).toContain("Openings unknown");
  });
});

describe("the way out the refusal offers", () => {
  it("archives the round from the refusal itself, destroying nothing", async () => {
    // "Archive it instead" has to be reachable from where Leif is told
    // no, and it has to actually work — otherwise it is advice to go and
    // do the thing he was just stopped from doing.
    const screen = await render(buildTestCrm());
    await expect
      .element(screen.getByText("Growing Yourself Up — Fall 2026"))
      .toBeVisible();

    const menus = await screen
      .getByRole("button", { name: "Program actions" })
      .all();
    await menus[1]!.click();
    await screen.getByRole("menuitem", { name: "Delete program" }).click();

    await expect
      .element(screen.getByText("Growing Yourself Up — Fall 2026 has history"))
      .toBeVisible();
    await screen.getByRole("button", { name: "Archive program" }).click();

    // Said plainly, because the difference between archiving and deleting
    // is the whole point of the offer.
    await expect
      .element(
        screen.getByText(
          "Growing Yourself Up — Fall 2026 archived. Nothing was deleted.",
        ),
      )
      .toBeVisible();
  });

  it("refuses to delete a program whose links it cannot read", async () => {
    // "We could not check" must never read as "safe to delete", so
    // countOf() reports 1 on a failed read. It matters more now than it
    // did: the guard asks about client_sessions and scholarship_slots as
    // well, because 20260921180000 made the database refuse those too,
    // and a guard that asks fewer questions than the database answers
    // would hand Leif a confirmation dialog followed by a raw foreign-key
    // error.
    //
    // The converse — that a genuinely empty program IS deletable — is
    // proven against real Postgres in e2e/programDeleteSafety.spec.ts,
    // where the tables the guard names actually exist.
    const blind = {
      getList: async () => {
        throw new Error("no such resource");
      },
    } as unknown as DataProvider;
    expect(await offerDeleteSafety(blind, individualProgram.id)).toMatchObject({
      deletable: false,
    });
  });
});
