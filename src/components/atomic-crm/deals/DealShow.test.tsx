import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import { buildContact, createCrmDb, StoryWrapper } from "@/test/StoryWrapper";
import type { Deal, Offer } from "@/components/atomic-crm/types";

// Programs + Opportunity UX slice, §4, reconfirmed by the Kanban
// queue-ordering slice: Expected Closing Date was never a real, kept-up-
// to-date signal, so it's gone from the Opportunity Show page entirely —
// even for a legacy record that still carries a value in the column.
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
  is_active: true,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

describe("DealShow", () => {
  it("never displays Expected Closing Date, even for a legacy record that still has one set", async () => {
    const contact = buildContact({ id: 1 });
    const deal: Deal = {
      id: 1,
      name: "Ada Lovelace",
      contact_id: 1,
      offer_id: 1,
      offer_name_snapshot: "The Living Example",
      stage: "interested",
      amount: 4000,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      sales_id: 0,
      index: 0,
      stage_entered_at: "2026-01-01T00:00:00.000Z",
      // A legacy value some pre-removal record could still carry — must
      // never render, not merely be absent when null.
      expected_closing_date: "2020-01-01",
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
      <StoryWrapper
        initialEntries={["/deals/1/show"]}
        dataProvider={dataProvider}
      >
        <></>
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("heading", { name: /ada lovelace/i }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText(/expected closing date/i))
      .not.toBeInTheDocument();
  });

  // Production defect repair: deals.amount has no NOT NULL constraint —
  // a Deal created outside the normal create/edit form's own amount-sync
  // effect (e.g. inserted directly, or any future path that doesn't go
  // through that form) can genuinely have no amount yet. A raw
  // record.amount.toLocaleString() call with no null guard crashed the
  // whole lightbox with an uncaught TypeError the instant such a Deal was
  // opened — found via a real Committed Opportunity with no amount set.
  it("renders without crashing when amount is null, showing no amount rather than throwing", async () => {
    const contact = buildContact({ id: 1 });
    const deal: Deal = {
      id: 1,
      name: "Ada Lovelace",
      contact_id: 1,
      offer_id: 1,
      offer_name_snapshot: "The Living Example",
      stage: "interested",
      amount: null as unknown as number,
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
      <StoryWrapper
        initialEntries={["/deals/1/show"]}
        dataProvider={dataProvider}
      >
        <></>
      </StoryWrapper>,
    );

    // The lightbox itself must render (no uncaught exception/error
    // boundary) — the amount field is simply absent, not a crash.
    await expect
      .element(screen.getByRole("heading", { name: /ada lovelace/i }))
      .toBeInTheDocument();
  });
});
