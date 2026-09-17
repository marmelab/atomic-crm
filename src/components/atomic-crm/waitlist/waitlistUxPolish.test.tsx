import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";

import { CRM } from "../root/CRM";
import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import { generateCohorts } from "@/components/atomic-crm/providers/fakerest/dataGenerator/cohorts";
import type { Cohort, Offer } from "../types";

// Pre-live UX pass: Add to Waitlist is a small centered dialog (not a
// full-height sheet), Source is stamped rather than asked, and a group
// Offer never auto-assigns a Cohort.

const livingExample: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  is_active: true,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const gyuOffer: Offer = {
  id: 2,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const januaryCohort: Cohort = {
  id: 2,
  offer_id: 2,
  name: "Growing Yourself Up — January 2027",
  status: "draft",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const buildTestCrm = () => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Wren", last_name: "Halloway" }),
      ],
      contact_notes: [],
      offers: [livingExample, gyuOffer],
      cohorts: [januaryCohort],
      offer_payment_options: [],
      applications: [],
      enrollments: [],
      deals: [],
      sales_calls: [],
      waitlist_entries: [],
      tasks: [],
    } as any),
    silent: true,
    latency: 0,
  });
  const element = (
    <MemoryRouter initialEntries={["/contacts/1/show"]}>
      <CRM
        dataProvider={dataProvider}
        authProvider={createTestAuthProvider()}
        i18nProvider={testI18nProvider}
        store={memoryStore()}
        disableTelemetry
      />
    </MemoryRouter>
  );
  return { element, dataProvider };
};

describe("Add to Waitlist UX", () => {
  it("opens a centered dialog, not a full-height sheet", async () => {
    const { element } = buildTestCrm();
    await page.viewport(1280, 900);
    const screen = await render(element);

    await screen.getByRole("button", { name: "Add to Waitlist" }).click();

    // role=dialog is the centered modal; the old sheet rendered with
    // data-slot="sheet-content" and a full-viewport height class.
    const dialog = screen.getByRole("dialog");
    await expect.element(dialog).toBeInTheDocument();
    expect(
      screen.container.ownerDocument.querySelector(
        '[data-slot="sheet-content"]',
      ),
    ).toBeNull();
  });

  it("does not ask for Source — a manual add stamps its own origin", async () => {
    const { element } = buildTestCrm();
    await page.viewport(1280, 900);
    const screen = await render(element);
    await screen.getByRole("button", { name: "Add to Waitlist" }).click();
    await expect.element(screen.getByRole("dialog")).toBeInTheDocument();

    const dialogText =
      screen.container.ownerDocument.querySelector('[role="dialog"]')
        ?.textContent ?? "";
    expect(dialogText).toContain("Program");
    expect(dialogText).not.toContain("Source");
    expect(dialogText).not.toContain("Unknown");
  });

  it("writes source = manual for a manually added entry", async () => {
    const { dataProvider } = buildTestCrm();
    const { data: created } = await dataProvider.create("waitlist_entries", {
      data: {
        contact_id: 1,
        offer_id: 1,
        cohort_id: null,
        status: "waiting",
        source: "manual",
        joined_at: new Date().toISOString(),
      },
    });
    expect(created.source).toBe("manual");
  });

  it("never auto-selects a Cohort for a group Offer", async () => {
    const { element } = buildTestCrm();
    await page.viewport(1280, 900);
    const screen = await render(element);
    await screen.getByRole("button", { name: "Add to Waitlist" }).click();

    // Choose the group Offer.
    await screen.getByRole("combobox").first().click();
    await screen.getByRole("option", { name: "Growing Yourself Up" }).click();

    const dialogText =
      screen.container.ownerDocument.querySelector('[role="dialog"]')
        ?.textContent ?? "";
    // The Cohort field appears, explicitly optional...
    expect(dialogText).toContain("Cohort (optional)");
    // ...and nothing is pre-selected, so a manual add never asserts a
    // cohort intent Leif did not choose.
    expect(dialogText).not.toContain("January 2027");
  });
});

describe("demo cohort fixtures", () => {
  it("offers Growing Yourself Up — January 2027 and no nonexistent November round", () => {
    const cohorts = generateCohorts();
    const names = cohorts.map((cohort) => cohort.name);
    expect(names).toContain("Growing Yourself Up — January 2027");
    expect(names.some((name) => /november/i.test(name))).toBe(false);
  });

  it("does not invent dates or capacity for the January 2027 round", () => {
    const january = generateCohorts().find((cohort) =>
      cohort.name.includes("January 2027"),
    )!;
    // Mirrors the tracked migration: only offer_id/name/status are known.
    expect(january.program_start_at ?? null).toBeNull();
    expect(january.program_end_at ?? null).toBeNull();
    expect(january.target_capacity ?? null).toBeNull();
  });
});
