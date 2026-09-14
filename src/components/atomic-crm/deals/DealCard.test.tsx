import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import type { Deal, Offer, SalesCall } from "@/components/atomic-crm/types";

// Go-Live Blocker: Sales-Call No-Show/Rebooking slice — the smallest
// useful Kanban-visibility fix: a Call Booked card whose latest Sales
// Call concluded as a no-show previously looked identical to one with a
// genuinely upcoming call (DealCard.tsx had zero awareness of
// sales_calls at all). See DealCard.tsx's SalesCallNoShowBadge.

const CONTACT_ID = 1;
const OFFER_ID = 1;
const DEAL_ID = 1;

const livingExample: Offer = {
  id: OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "6 months",
  current_price: 4000,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  pricing_mode: "standard",
  id: DEAL_ID,
  name: "Ada Lovelace",
  contact_id: CONTACT_ID,
  offer_id: OFFER_ID,
  stage: "call_booked",
  outcome: null,
  owner_decision: null,
  amount: 4000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildSalesCall = (overrides: Partial<SalesCall> = {}): SalesCall => ({
  id: 1,
  opportunity_id: DEAL_ID,
  contact_id: CONTACT_ID,
  status: "booked",
  original_scheduled_at: "2026-09-01T15:00:00.000Z",
  scheduled_at: "2026-09-01T15:00:00.000Z",
  reschedule_count: 0,
  source: "manual",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("DealCard — Sales-Call No-Show badge", () => {
  it("shows a No-show badge for a Call Booked Opportunity whose latest call concluded as a no-show", async () => {
    const contact = buildContact({ id: CONTACT_ID });
    const deal = buildDeal();
    const salesCall = buildSalesCall({
      status: "completed",
      attendance: "no_show",
      attendance_recorded_at: "2026-09-05T00:00:00.000Z",
    });

    const screen = await render(
      <StoryWrapper
        initialEntries={["/deals"]}
        data={{
          contacts: [contact],
          offers: [livingExample],
          deals: [deal],
          sales_calls: [salesCall],
        }}
      >
        <></>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("No-show")).toBeInTheDocument();
  });

  it("shows no badge while a call is still pending (attendance not yet recorded)", async () => {
    const contact = buildContact({ id: CONTACT_ID });
    const deal = buildDeal();
    const salesCall = buildSalesCall({ status: "booked", attendance: null });

    const screen = await render(
      <StoryWrapper
        initialEntries={["/deals"]}
        data={{
          contacts: [contact],
          offers: [livingExample],
          deals: [deal],
          sales_calls: [salesCall],
        }}
      >
        <></>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    await expect.element(screen.getByText("No-show")).not.toBeInTheDocument();
  });

  it("shows no badge once a fresh booking exists after a prior no-show — the latest call wins", async () => {
    const contact = buildContact({ id: CONTACT_ID });
    const deal = buildDeal();
    const concludedNoShow = buildSalesCall({
      id: 1,
      status: "completed",
      attendance: "no_show",
      attendance_recorded_at: "2026-09-05T00:00:00.000Z",
    });
    const freshBooking = buildSalesCall({
      id: 2,
      status: "booked",
      attendance: null,
      scheduled_at: "2026-09-20T15:00:00.000Z",
      original_scheduled_at: "2026-09-20T15:00:00.000Z",
    });

    const screen = await render(
      <StoryWrapper
        initialEntries={["/deals"]}
        data={{
          contacts: [contact],
          offers: [livingExample],
          deals: [deal],
          sales_calls: [concludedNoShow, freshBooking],
        }}
      >
        <></>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    await expect.element(screen.getByText("No-show")).not.toBeInTheDocument();
  });

  it("shows no badge for an attended (not no-show) concluded call", async () => {
    const contact = buildContact({ id: CONTACT_ID });
    const deal = buildDeal();
    const salesCall = buildSalesCall({
      status: "completed",
      attendance: "attended",
      attendance_recorded_at: "2026-09-05T00:00:00.000Z",
    });

    const screen = await render(
      <StoryWrapper
        initialEntries={["/deals"]}
        data={{
          contacts: [contact],
          offers: [livingExample],
          deals: [deal],
          sales_calls: [salesCall],
        }}
      >
        <></>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    await expect.element(screen.getByText("No-show")).not.toBeInTheDocument();
  });
});
