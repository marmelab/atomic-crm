import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import { buildContact, createCrmDb, StoryWrapper } from "@/test/StoryWrapper";
import type { Deal, Offer } from "@/components/atomic-crm/types";

// Human-acceptance repair pass, §Repair 3: generic Edit must never expose
// owner_decision/prospect_decision/follow_up_date/sales_call_at as raw
// editable fields again — that's exactly how a real accepted call ended up
// recorded as "Would Work With / Yes" while the Opportunity silently
// stayed at Call Booked (generic Edit writes raw fields with no
// synchronization). Source/Entry path stay — they're genuine metadata,
// not business events requiring Complete Sales Call's synchronization.
const emptyRelatedCollections = {
  offer_payment_options: [],
  cohorts: [],
  applications: [],
  enrollments: [],
};

const livingExample: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  max_active_clients: 12,
  is_active: true,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

describe("DealInputs (generic Edit)", () => {
  it("does not expose owner_decision, prospect_decision, follow_up_date, or sales_call_at as editable fields", async () => {
    const contact = buildContact({ id: 1 });
    const deal: Deal = {
      id: 1,
      name: "Ada Lovelace",
      contact_id: 1,
      offer_id: 1,
      offer_name_snapshot: "The Living Example",
      stage: "call_booked",
      owner_decision: null,
      prospect_decision: null,
      amount: 4000,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      sales_id: 0,
      index: 0,
      stage_entered_at: "2026-01-01T00:00:00.000Z",
    };
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [contact],
        offers: [livingExample],
        deals: [deal],
        ...emptyRelatedCollections,
      }),
      silent: true,
    });

    const screen = await render(
      <StoryWrapper initialEntries={["/deals/1"]} dataProvider={dataProvider}>
        <></>
      </StoryWrapper>,
    );

    // Still present — genuine metadata, not a business event.
    await expect
      .element(screen.getByLabelText(/^source$/i))
      .toBeInTheDocument();
    await expect
      .element(screen.getByLabelText(/entry path/i))
      .toBeInTheDocument();

    // Gone — only Complete Sales Call may write these now.
    await expect
      .element(screen.getByLabelText(/owner decision/i))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByLabelText(/prospect decision/i))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByLabelText(/follow-up date/i))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByLabelText(/^sales call$/i))
      .not.toBeInTheDocument();
    // Programs + Opportunity UX slice, §4 (reconfirmed by the Kanban
    // queue-ordering slice): never a create/edit input, so it can never
    // block a save.
    await expect
      .element(screen.getByLabelText(/expected closing date/i))
      .not.toBeInTheDocument();
  });

  it("does not require Expected Closing Date to save the form", async () => {
    const contact = buildContact({ id: 1 });
    const deal: Deal = {
      id: 1,
      name: "Ada Lovelace",
      contact_id: 1,
      offer_id: 1,
      offer_name_snapshot: "The Living Example",
      stage: "call_booked",
      owner_decision: null,
      prospect_decision: null,
      amount: 4000,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      sales_id: 0,
      index: 0,
      stage_entered_at: "2026-01-01T00:00:00.000Z",
      expected_closing_date: null,
    };
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [contact],
        offers: [livingExample],
        deals: [deal],
        ...emptyRelatedCollections,
      }),
      silent: true,
    });

    const screen = await render(
      <StoryWrapper initialEntries={["/deals/1"]} dataProvider={dataProvider}>
        <></>
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: /save/i }).click();

    // A blocking "required" validation error on a field this form doesn't
    // even render would leave the Edit form (and its "Source" input) in
    // place; instead the save succeeds and DealEdit's own onSuccess
    // navigates to the Show page, so the Edit form is gone.
    await expect
      .element(screen.getByLabelText(/^source$/i))
      .not.toBeInTheDocument();
  });
});

// Small polish/cleanup slice: root-caused to admin/number-input.tsx
// itself, not this usage — NumberInput spread react-admin's own
// "defaultValue" (the seed-a-new-record concept useInput reads) straight
// onto the underlying <input>'s DOM props, alongside the explicit `value`
// it also sets, which is exactly what triggers React's controlled/
// uncontrolled warning. Fixed at the component level (strips
// `defaultValue` from the DOM-bound `...rest`, same as the already-
// existing `validate`/`format` handling), so every NumberInput caller
// benefits — regression-tested here through Potential Value
// (deals/DealInputs.tsx's `defaultValue={0}`), the field that surfaced it.
describe("DealInputs (Create) — Potential Value", () => {
  it("auto-populates from the selected Offer with no controlled/uncontrolled console warning", async () => {
    const errors: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args);
    });

    const dataProvider = createDataProvider({
      db: createCrmDb({
        // DealEmpty.tsx only renders <DealCreate> once at least one
        // Contact exists — otherwise it shows the "add a Contact first"
        // empty state instead.
        contacts: [buildContact({ id: 1 })],
        offers: [livingExample],
        ...emptyRelatedCollections,
      }),
      silent: true,
    });

    const screen = await render(
      <StoryWrapper
        initialEntries={["/deals/create"]}
        dataProvider={dataProvider}
      >
        <></>
      </StoryWrapper>,
    );

    const amountInput = screen.getByLabelText(/potential value/i);
    await expect.element(amountInput).toHaveValue(0);

    // Preserve current behavior: selecting an Offer still auto-populates
    // Potential Value from its price.
    await screen.getByLabelText(/^offer/i).click();
    await screen.getByText("The Living Example").click();
    await expect.element(amountInput).toHaveValue(4000);

    const controlledWarnings = errors.filter((args) =>
      args.some((arg) => typeof arg === "string" && /controlled/i.test(arg)),
    );
    expect(controlledWarnings).toHaveLength(0);
  });
});
