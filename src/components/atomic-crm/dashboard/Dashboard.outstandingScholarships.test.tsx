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
import type { Deal, Offer } from "@/components/atomic-crm/types";

// Scholarship Pricing + Capacity slice: the small, deliberately narrow
// Dashboard surface for the one risk the locked "no TTL, no automatic
// expiration" reservation design accepts — an outstanding (Deal-held,
// unpaid) scholarship reservation nobody has released. See
// useOutstandingScholarshipReservations.ts's own header for why a current
// (Enrollment-held) scholarship is deliberately NOT duplicated here.
const leOffer: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  scholarship_price: 3000,
  is_active: true,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const scholarshipDeal: Deal = {
  id: 1,
  name: "Ada Lovelace",
  contact_id: 1,
  offer_id: 1,
  pricing_mode: "scholarship",
  stage: "committed",
  outcome: null,
  amount: 3000,
  offer_name_snapshot: "The Living Example",
  offer_price_snapshot: 3000,
  sales_id: 0,
  index: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  stage_entered_at: "2026-01-01T00:00:00.000Z",
};

const buildTestCrm = (
  extra: Partial<Parameters<typeof createCrmDb>[0]> = {},
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      offers: [leOffer],
      deals: [scholarshipDeal],
      scholarship_slots: [
        {
          id: 1,
          offer_id: 1,
          holder_deal_id: 1,
          holder_enrollment_id: null,
          reserved_at: "2026-01-01T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      ...extra,
    }),
    silent: true,
  });

  return (
    <MemoryRouter initialEntries={["/"]}>
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
};

describe("Dashboard — Outstanding Scholarship Reservations", () => {
  it("shows an outstanding (unpaid) scholarship reservation and links to the Deal", async () => {
    await page.viewport(1280, 900);
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByText("Outstanding Scholarship Reservations"))
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByText(
          "The Living Example scholarship reserved for Ada Lovelace — not yet paid",
        ),
      )
      .toBeInTheDocument();

    const link = screen.getByRole("link", {
      name: /scholarship reserved for Ada Lovelace/,
    });
    await expect.element(link).toHaveAttribute("href", "/deals/1/show");
  });

  it("never shows a section when no scholarship slot is currently outstanding", async () => {
    await page.viewport(1280, 900);
    const screen = await render(buildTestCrm({ scholarship_slots: [] } as any));

    await expect
      .element(screen.getByText("Outstanding Scholarship Reservations"))
      .not.toBeInTheDocument();
  });

  it("never shows a CURRENT (Enrollment-held) scholarship here — only outstanding, unpaid ones", async () => {
    await page.viewport(1280, 900);
    const screen = await render(
      buildTestCrm({
        scholarship_slots: [
          {
            id: 1,
            offer_id: 1,
            holder_deal_id: null,
            holder_enrollment_id: 1,
            reserved_at: "2026-01-01T00:00:00.000Z",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      } as any),
    );

    await expect
      .element(screen.getByText("Outstanding Scholarship Reservations"))
      .not.toBeInTheDocument();
  });
});
