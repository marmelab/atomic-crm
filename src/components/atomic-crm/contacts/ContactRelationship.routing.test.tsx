import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";

import { CRM } from "../root/CRM";
import { Notification } from "@/components/admin/notification";
import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";
import type { Cohort, Offer } from "../types";

// Pre-live UX pass: the Contact page's MAIN canvas must answer "what is
// this human's history with me?" — Opportunities, Applications (including
// Deal-less ones, per Gate A), Waitlists and a derived history. These
// render the real <CRM> through a route, the same convention
// waitlist.routing.test.tsx uses.

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

const buildTestCrm = (overrides: Partial<Db> = {}) => {
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
      ...overrides,
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
        layout={({ children }) => (
          <>
            {children}
            <Notification />
          </>
        )}
      />
    </MemoryRouter>
  );
  return { element, dataProvider };
};

const deal = {
  id: 10,
  name: "Wren Halloway — The Living Example",
  contact_id: 1,
  offer_id: 1,
  stage: "call_booked",
  outcome: null,
  owner_decision: null,
  amount: 4000,
  pricing_mode: "standard",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-09-01T00:00:00.000Z",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
};

describe("Contact page relationship canvas", () => {
  it("surfaces Opportunities in the main canvas", async () => {
    const { element } = buildTestCrm({ deals: [deal] } as any);
    await page.viewport(1280, 900);
    const screen = await render(element);
    await expect.element(screen.getByText("Relationship")).toBeInTheDocument();
    expect(screen.container.textContent).toContain("Opportunities");
    expect(screen.container.textContent).toContain("The Living Example");
    expect(screen.container.textContent).toContain("call booked");
    // The row names the OFFER, never "<Person> — <Offer>": the page
    // heading already says whose page this is.
    expect(screen.container.textContent).not.toContain(
      "Wren Halloway — The Living Example",
    );
  });

  it("surfaces an Application that has NO Opportunity (Gate A: Applications belong to the Contact)", async () => {
    const { element } = buildTestCrm({
      applications: [
        {
          id: 77,
          contact_id: 1,
          // No Deal — and none is fabricated to make it visible.
          opportunity_id: null,
          offer_id: 2,
          intended_cohort_id: null,
          status: "pending",
          source: "historical_import",
          submitted_at: "2026-08-01T10:00:00.000Z",
          reviewed_at: null,
          raw_answers: {},
          summary: null,
          created_at: "2026-08-01T10:00:00.000Z",
          updated_at: "2026-08-01T10:00:00.000Z",
        },
      ],
    } as any);
    await page.viewport(1280, 900);
    const screen = await render(element);
    // The Applications section renders it despite there being no Deal.
    await expect.element(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("No applications yet.");
  });

  it("keeps a REMOVED waitlist membership visible as history", async () => {
    const { element } = buildTestCrm({
      waitlist_entries: [
        {
          id: 5,
          contact_id: 1,
          offer_id: 1,
          cohort_id: null,
          status: "removed",
          joined_at: "2026-08-01T00:00:00.000Z",
          removed_at: "2026-08-20T00:00:00.000Z",
          source: "manual",
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-20T00:00:00.000Z",
        },
      ],
    } as any);
    await page.viewport(1280, 900);
    const screen = await render(element);
    await expect.element(screen.getByText("Waitlists")).toBeInTheDocument();
    // Still listed after removal, with both dates — history, not a delete.
    expect(screen.container.textContent).toContain("Removed");
    expect(screen.container.textContent).toContain("The Living Example");
  });

  it("builds the derived history from canonical records only, newest first", async () => {
    const { element } = buildTestCrm({
      deals: [deal],
      sales_calls: [
        {
          id: 3,
          opportunity_id: 10,
          contact_id: 1,
          status: "completed",
          attendance: "no_show",
          attendance_recorded_at: "2026-09-20T00:00:00.000Z",
          original_scheduled_at: "2026-09-10T00:00:00.000Z",
          scheduled_at: "2026-09-10T00:00:00.000Z",
          reschedule_count: 0,
          source: "manual",
          created_at: "2026-09-01T00:00:00.000Z",
          updated_at: "2026-09-20T00:00:00.000Z",
        },
      ],
    } as any);
    await page.viewport(1280, 900);
    const screen = await render(element);
    // Every row is derived from a stored timestamp on a canonical record.
    await expect
      .element(screen.getByText("Sales call — No-show"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Sales call booked"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Opportunity created"))
      .toBeInTheDocument();
  });

  it("offers Add note directly from the History header, without hunting", async () => {
    const { element } = buildTestCrm();
    await page.viewport(1280, 900);
    const screen = await render(element);

    // Visible on the History panel itself — the previous lone button below
    // the relationship data could not be found during human acceptance.
    const history = screen.container.ownerDocument.body;
    await expect.element(screen.getByText("History")).toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Add note" }))
      .toBeInTheDocument();
    expect(history.textContent).not.toContain("No notes yet");
  });

  it("expands a compact composer from History and keeps the giant textarea gone", async () => {
    const { element } = buildTestCrm();
    await page.viewport(1280, 900);
    const screen = await render(element);

    // Collapsed by default: no composer textarea until asked for.
    expect(
      screen.container.ownerDocument.querySelectorAll("textarea").length,
    ).toBe(0);

    await screen.getByRole("button", { name: "Add note" }).click();
    // The composer mounts once the current identity resolves.
    await expect
      .element(screen.getByRole("textbox").first())
      .toBeInTheDocument();
  });

  it("renders saved notes as History rows using their own timestamp", async () => {
    const { element } = buildTestCrm({
      contact_notes: [
        {
          id: 9,
          contact_id: 1,
          text: "Talked through timing",
          date: "2026-09-05T10:00:00.000Z",
          sales_id: 0,
          status: "warm",
        },
      ],
    } as any);
    await page.viewport(1280, 900);
    const screen = await render(element);
    // expect.element polls, unlike a raw textContent read.
    await expect
      .element(screen.getByText("Talked through timing"))
      .toBeInTheDocument();
  });

  it("derives an invitation event per invitation, so a repeat invite reads as a repeat", async () => {
    const { element } = buildTestCrm({
      waitlist_entries: [
        {
          id: 5,
          contact_id: 1,
          offer_id: 1,
          cohort_id: null,
          status: "invited",
          joined_at: "2026-08-01T00:00:00.000Z",
          invited_at: "2026-10-03T00:00:00.000Z",
          source: "manual",
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-10-03T00:00:00.000Z",
        },
      ],
      waitlist_invitation_batches: [
        {
          id: 1,
          offer_id: 1,
          cohort_id: null,
          label: null,
          status: "completed",
          created_at: "2026-08-20T00:00:00.000Z",
          updated_at: "2026-08-20T00:00:00.000Z",
        },
        {
          id: 2,
          offer_id: 1,
          cohort_id: null,
          label: null,
          status: "completed",
          created_at: "2026-10-03T00:00:00.000Z",
          updated_at: "2026-10-03T00:00:00.000Z",
        },
      ],
      waitlist_invitations: [
        {
          id: 1,
          batch_id: 1,
          waitlist_entry_id: 5,
          contact_id: 1,
          status: "sent",
          delivery_method: "gmail",
          prepared_at: "2026-08-20T00:00:00.000Z",
          sent_at: "2026-08-20T00:00:00.000Z",
          created_at: "2026-08-20T00:00:00.000Z",
          updated_at: "2026-08-20T00:00:00.000Z",
        },
        {
          id: 2,
          batch_id: 2,
          waitlist_entry_id: 5,
          contact_id: 1,
          status: "sent",
          delivery_method: "gmail",
          prepared_at: "2026-10-03T00:00:00.000Z",
          sent_at: "2026-10-03T00:00:00.000Z",
          created_at: "2026-10-03T00:00:00.000Z",
          updated_at: "2026-10-03T00:00:00.000Z",
        },
      ],
    } as any);
    await page.viewport(1280, 900);
    const screen = await render(element);

    // BOTH invitations appear — derived from the invitation records, never
    // from waitlist_entries.status, which can only remember the last one.
    await expect
      .element(
        screen
          .getByText(
            "Invited from the The Living Example waitlist to book a sales call",
          )
          .first(),
      )
      .toBeInTheDocument();
    const rows = screen.container.ownerDocument.body.textContent ?? "";
    const occurrences = rows.split("waitlist to book a sales call").length - 1;
    expect(occurrences).toBe(2);
  });

  it("groups the relationship into one panel rather than floating sections", async () => {
    const { element } = buildTestCrm({ deals: [deal] } as any);
    await page.viewport(1280, 900);
    const screen = await render(element);
    // One Relationship container and one History container.
    await expect.element(screen.getByText("Relationship")).toBeInTheDocument();
    await expect.element(screen.getByText("History")).toBeInTheDocument();
  });
});
