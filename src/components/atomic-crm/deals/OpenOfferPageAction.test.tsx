import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { StoryWrapper, buildContact } from "@/test/StoryWrapper";
import type { Deal, Offer } from "@/components/atomic-crm/types";

// Payment domain foundation slice, human-acceptance repair: the personalized
// Offer Page route has always worked once you have the token, but nothing
// in the authenticated CRM ever surfaced a way to reach it — see
// OpenOfferPageAction.tsx's own header for the full context.
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

const baseDeal: Deal = {
  id: 1,
  name: "Ada Lovelace",
  contact_id: 1,
  offer_id: 1,
  offer_name_snapshot: "The Living Example",
  stage: "committed",
  amount: 4000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
};

const emptyRelatedCollections = {
  offer_payment_options: [],
  cohorts: [],
  applications: [],
  enrollments: [],
};

describe("OpenOfferPageAction", () => {
  it("renders 'Open Offer Page' pointing at the current origin's hash route when a token exists, without exposing the raw token as text", async () => {
    const contact = buildContact({ id: 1 });
    const deal: Deal = {
      ...baseDeal,
      offer_page_token: "test-token-abc123",
    };

    const screen = await render(
      <StoryWrapper
        initialEntries={["/deals/1/show"]}
        data={{
          contacts: [contact],
          offers: [livingExample],
          deals: [deal],
          ...emptyRelatedCollections,
        }}
      >
        <></>
      </StoryWrapper>,
    );

    const link = screen.getByRole("link", { name: "Open Offer Page" });
    await expect.element(link).toBeInTheDocument();
    await expect
      .element(link)
      .toHaveAttribute(
        "href",
        `${window.location.origin}/#/offer/test-token-abc123`,
      );
    await expect.element(link).toHaveAttribute("target", "_blank");

    // The raw token is only ever used to build the href — never rendered
    // as its own visible text node.
    await expect
      .element(screen.getByText("test-token-abc123"))
      .not.toBeInTheDocument();
  });

  it("never renders 'Open Offer Page' when the Opportunity has no offer_page_token yet", async () => {
    const contact = buildContact({ id: 1 });
    const deal: Deal = { ...baseDeal, offer_page_token: null };

    const screen = await render(
      <StoryWrapper
        initialEntries={["/deals/1/show"]}
        data={{
          contacts: [contact],
          offers: [livingExample],
          deals: [deal],
          ...emptyRelatedCollections,
        }}
      >
        <></>
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("heading", { name: /ada lovelace/i }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Open Offer Page"))
      .not.toBeInTheDocument();
  });
});
