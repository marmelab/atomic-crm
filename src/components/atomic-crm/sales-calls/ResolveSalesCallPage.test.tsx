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
import type { Deal, Offer, SalesCall } from "@/components/atomic-crm/types";

// Unmatched Sales Call Resolution slice: the dedicated resolution page,
// the real fix for "clicking the Task opens the generic editor, which
// can't answer 'what Opportunity does this belong to?'".
const leOffer: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "6 months",
  current_price: 4000,
  is_active: true,
  acuity_appointment_type_id: "99001",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const gyuOffer: Offer = {
  id: 2,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildSalesCall = (overrides: Partial<SalesCall> = {}): SalesCall => ({
  id: 1,
  opportunity_id: null,
  contact_id: 1,
  status: "booked",
  original_scheduled_at: "2026-09-10T18:00:00.000Z",
  scheduled_at: "2026-09-10T18:00:00.000Z",
  reschedule_count: 0,
  source: "acuity",
  acuity_appointment_id: "acuity-1",
  acuity_appointment_type_id: "99001",
  dismissed_at: null,
  dismissal_reason: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildTestCrm = ({
  salesCall,
  deals = [],
}: {
  salesCall: SalesCall;
  deals?: Deal[];
}) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      offers: [leOffer, gyuOffer],
      cohorts: [],
      deals,
      sales_calls: [salesCall],
      sales_call_events: [],
      tasks: [],
    } as any),
    silent: true,
  });
  return {
    dataProvider,
    element: (
      <MemoryRouter initialEntries={["/sales-calls/1/resolve"]}>
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
    ),
  };
};

describe("ResolveSalesCallPage", () => {
  it("shows Contact/Offer/date context and the SPECIFIC reason human intervention is required — zero compatible Opportunities", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({ salesCall: buildSalesCall() });
    const screen = await render(element);

    await expect
      .element(screen.getByRole("link", { name: "Ada Lovelace" }))
      .toHaveAttribute("href", "/contacts/1/show");
    await expect
      .element(
        screen.getByText("Ada Lovelace · The Living Example", {
          exact: false,
        }),
      )
      .toBeInTheDocument();

    // Human-acceptance repair, round 3/4: "couldn't be matched, tell the
    // CRM where it belongs" answered nothing about WHY. This is the actual
    // reason the CRM already knows — zero compatible Opportunities — with
    // a heading that stays grammatical for any Offer name (never "No The
    // Living Example opportunity found" — round 4's fix) and the
    // authoritative Offer named in the body instead.
    await expect
      .element(screen.getByText("No matching opportunity found"))
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByText(
          "Ada Lovelace booked a sales call for The Living Example, but they don't have an open opportunity for The Living Example in the CRM.",
        ),
      )
      .toBeInTheDocument();
  });

  it("attaches to a compatible existing Opportunity and shows an immediate success acknowledgment, never the cold revisit copy", async () => {
    await page.viewport(1280, 900);
    const { dataProvider, element } = buildTestCrm({
      salesCall: buildSalesCall(),
      deals: [
        {
          id: 10,
          name: "Ada Lovelace — The Living Example",
          contact_id: 1,
          offer_id: 1,
          offer_name_snapshot: "The Living Example",
          stage: "approved",
          outcome: null,
          amount: 4000,
          sales_id: 0,
          index: 0,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          stage_entered_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const screen = await render(element);

    // Exactly one compatible Opportunity: specific "found" copy, and
    // Create is withheld — offering it here would just manufacture a
    // duplicate next to the one that already matches.
    await expect
      .element(screen.getByText("A matching opportunity was found"))
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByRole("button", {
          name: "Create The Living Example opportunity",
        }),
      )
      .not.toBeInTheDocument();

    await expect
      .element(screen.getByText("Attach", { exact: true }))
      .toBeInTheDocument();
    await screen.getByText("Attach", { exact: true }).click();

    // Immediate success acknowledgment — Leif just did this himself.
    await expect
      .element(screen.getByText("Sales call attached ✓"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Ada Lovelace · The Living Example"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("link", { name: "View the Opportunity" }))
      .toHaveAttribute("href", "/deals/10/show");
    await expect
      .element(
        screen.getByText("This booking is already attached to an Opportunity."),
      )
      .not.toBeInTheDocument();

    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: 1 },
    );
    expect(salesCall.opportunity_id).toBe(10);
  });

  it("shows the specific ambiguity reason and both candidates when more than one compatible Opportunity exists, and withholds Create", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      salesCall: buildSalesCall(),
      deals: [
        {
          id: 10,
          name: "Ada Lovelace — The Living Example (Spring)",
          contact_id: 1,
          offer_id: 1,
          offer_name_snapshot: "The Living Example",
          stage: "approved",
          outcome: null,
          amount: 4000,
          sales_id: 0,
          index: 0,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          stage_entered_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: 11,
          name: "Ada Lovelace — The Living Example (Fall)",
          contact_id: 1,
          offer_id: 1,
          offer_name_snapshot: "The Living Example",
          stage: "call_booked",
          outcome: null,
          amount: 4000,
          sales_id: 0,
          index: 1,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          stage_entered_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const screen = await render(element);

    await expect
      .element(
        screen.getByText("More than one opportunity could match this call"),
      )
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByText(
          "Ada Lovelace booked a sales call for The Living Example. Choose the opportunity this call belongs to.",
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByText("Ada Lovelace — The Living Example (Spring)", {
          exact: true,
        }),
      )
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByText("Ada Lovelace — The Living Example (Fall)", {
          exact: true,
        }),
      )
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByRole("button", {
          name: "Create The Living Example opportunity",
        }),
      )
      .not.toBeInTheDocument();
  });

  it("shows the plain revisit copy (not the success acknowledgment) on a fresh page load of an already-resolved booking", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      salesCall: buildSalesCall({ opportunity_id: 10 }),
      deals: [
        {
          id: 10,
          name: "Ada Lovelace — The Living Example",
          contact_id: 1,
          offer_id: 1,
          offer_name_snapshot: "The Living Example",
          stage: "call_booked",
          outcome: null,
          amount: 4000,
          sales_id: 0,
          index: 0,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          stage_entered_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const screen = await render(element);

    await expect
      .element(
        screen.getByText("This booking is already attached to an Opportunity."),
      )
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Sales call attached ✓"))
      .not.toBeInTheDocument();
  });

  it("never offers an incompatible Opportunity from another Offer", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      salesCall: buildSalesCall(),
      deals: [
        {
          id: 11,
          name: "Ada Lovelace — Growing Yourself Up",
          contact_id: 1,
          offer_id: 2,
          stage: "approved",
          outcome: null,
          amount: 1400,
          sales_id: 0,
          index: 0,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          stage_entered_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const screen = await render(element);

    // An incompatible Opportunity doesn't count as a match at all — the
    // page reads this exactly like zero compatible Opportunities exist.
    await expect
      .element(screen.getByText("No matching opportunity found"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Attach to an existing Opportunity"))
      .not.toBeInTheDocument();
    await expect
      .element(
        screen.getByText("Ada Lovelace — Growing Yourself Up", {
          exact: true,
        }),
      )
      .not.toBeInTheDocument();
  });

  it("creates the mapped Offer's Opportunity when none exists, exactly once", async () => {
    await page.viewport(1280, 900);
    const { dataProvider, element } = buildTestCrm({
      salesCall: buildSalesCall(),
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("No matching opportunity found"))
      .toBeInTheDocument();

    const createButton = screen.getByRole("button", {
      name: "Create The Living Example opportunity",
    });
    await expect.element(createButton).toBeInTheDocument();
    await createButton.click();

    // Immediate success acknowledgment, not the cold "already attached"
    // revisit copy — handle_deal_saved() (02_functions.sql) stamps
    // offer_name_snapshot server-side on every create, so this is real
    // even though the client never set it explicitly.
    await expect
      .element(screen.getByText("Sales call attached ✓"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Ada Lovelace · The Living Example"))
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByText("This booking is already attached to an Opportunity."),
      )
      .not.toBeInTheDocument();

    const { total } = await dataProvider.getList<Deal>("deals", {
      filter: { contact_id: 1 },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);
  });

  it("dismisses the booking with a reason, never creating an Opportunity", async () => {
    await page.viewport(1280, 900);
    const { dataProvider, element } = buildTestCrm({
      salesCall: buildSalesCall(),
    });
    const screen = await render(element);

    await screen.getByRole("button", { name: "Dismiss booking" }).click();
    await screen
      .getByPlaceholder("Why? (optional) — test booking, mistake, etc.")
      .fill("Test booking");
    const confirmButtons = screen.getByRole("button", {
      name: "Dismiss booking",
    });
    await confirmButtons.last().click();

    await expect
      .element(
        screen.getByText(
          "This booking was dismissed — it was never a sales situation.",
        ),
      )
      .toBeInTheDocument();

    const { data: salesCall } = await dataProvider.getOne<SalesCall>(
      "sales_calls",
      { id: 1 },
    );
    expect(salesCall.dismissed_at).toBeTruthy();
    expect(salesCall.dismissal_reason).toBe("Test booking");

    const { total } = await dataProvider.getList<Deal>("deals", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(0);
  });
});
