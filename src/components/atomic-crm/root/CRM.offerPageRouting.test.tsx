import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore, type AuthProvider } from "ra-core";
import { MemoryRouter } from "react-router";

import { CRM } from "./CRM";
import { Notification } from "@/components/admin/notification";
import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import { createDataProviderPublicOfferPageDataSource } from "@/components/atomic-crm/deals/publicOfferPageDataSource";
import { buildContact, createCrmDb } from "@/test/StoryWrapper";
import type {
  Deal,
  Offer,
  OfferPaymentOption,
} from "@/components/atomic-crm/types";

// Payment domain foundation slice: proves the REAL <CRM/> tree (the same
// one src/App.tsx mounts) reaches /offer/:token WITHOUT logging in, the
// same "unauthenticated public route" proof CRM.publicApplicationRouting.test.tsx
// already established for /apply/*.
const unauthenticatedProvider: AuthProvider = {
  checkAuth: async () => {
    throw new Error("not authenticated");
  },
  checkError: async () => undefined,
  login: async () => undefined,
  logout: async () => undefined,
  getIdentity: async () => {
    throw new Error("not authenticated");
  },
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

const paymentOption: OfferPaymentOption = {
  id: 1,
  offer_id: 2,
  name: "Pay in Full",
  total: 1400,
  installments: 1,
  installment_amount: 1400,
  is_public: true,
  pricing_mode: "standard",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const installmentPaymentOption: OfferPaymentOption = {
  id: 5,
  offer_id: 2,
  name: "Monthly",
  total: 1400,
  installments: 2,
  installment_amount: 700,
  is_public: true,
  pricing_mode: "standard",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  pricing_mode: "standard",
  id: 1,
  name: "Ada Lovelace — Growing Yourself Up",
  contact_id: 1,
  offer_id: 2,
  stage: "committed",
  outcome: null,
  amount: 1400,
  offer_name_snapshot: "Growing Yourself Up",
  offer_price_snapshot: 1400,
  offer_page_token: "real-token-123",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

const renderOfferPageRoute = async (deal: Deal, initialEntry: string) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      offers: [gyuOffer],
      offer_payment_options: [paymentOption, installmentPaymentOption],
      deals: [deal],
      enrollments: [],
      cohorts: [],
    } as any),
    silent: true,
    latency: 0,
  });
  const publicOfferPageDataSource =
    createDataProviderPublicOfferPageDataSource(dataProvider);
  return {
    dataProvider,
    screen: await render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <CRM
          dataProvider={dataProvider}
          authProvider={unauthenticatedProvider}
          i18nProvider={testI18nProvider}
          store={memoryStore()}
          disableTelemetry
          publicOfferPageDataSource={publicOfferPageDataSource}
          layout={({ children }) => (
            <>
              {children}
              <Notification />
            </>
          )}
        />
      </MemoryRouter>,
    ),
  };
};

describe("Public /offer/:token route — unauthenticated access + real wiring", () => {
  it("renders the frozen offer for a real token with no login redirect, and records the first open through the SAME dataProvider the CRM itself reads", async () => {
    await page.viewport(1280, 900);
    const { dataProvider, screen } = await renderOfferPageRoute(
      buildDeal(),
      "/offer/real-token-123",
    );

    await expect
      .element(screen.getByText("Growing Yourself Up"))
      .toBeInTheDocument();
    // "$1,400 USD" (the frozen price) is a substring of "$1,400 USD once"
    // (the payment option's own line) — assert the full, unambiguous
    // strings rather than the shared prefix. The explicit "USD" suffix
    // (human-acceptance repair: international clients need the currency
    // unambiguous, not just a bare "$") comes from
    // ConfigurationContextValue.currency, not a hardcoded literal.
    await expect
      .element(screen.getByText("$1,400 USD", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("$1,400 USD once"))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Pay in Full")).toBeInTheDocument();

    await expect
      .poll(async () => {
        const { data } = await dataProvider.getOne<Deal>("deals", { id: 1 });
        return data.offer_page_opened_at;
      })
      .toBeTruthy();
  });

  it("an unknown token shows a not-found notice, never a Deal's real data", async () => {
    await page.viewport(1280, 900);
    const { screen } = await renderOfferPageRoute(
      buildDeal(),
      "/offer/wrong-token",
    );

    await expect
      .element(screen.getByText("This link isn't available right now."))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Growing Yourself Up"))
      .not.toBeInTheDocument();
  });

  it("a Deal already at Won shows the completed state, not a stale payment option list", async () => {
    await page.viewport(1280, 900);
    const { screen } = await renderOfferPageRoute(
      buildDeal({ stage: "won" }),
      "/offer/real-token-123",
    );

    await expect
      .element(screen.getByText("Payment received ✓"))
      .toBeInTheDocument();
  });

  it("a Deal already Won on an installment plan says the FIRST payment was received, never implying the whole plan is paid", async () => {
    await page.viewport(1280, 900);
    const { screen } = await renderOfferPageRoute(
      buildDeal({
        stage: "won",
        selected_payment_option_id: 5,
        selected_payment_total: 1400,
        selected_installment_count: 2,
        selected_installment_amount: 700,
      }),
      "/offer/real-token-123",
    );

    await expect
      .element(screen.getByText("Payment received ✓"))
      .toBeInTheDocument();
    // The plan's shape ("2 × $700 USD") stays visible per Leif's own
    // instruction to keep the selected payment option visible — but it is
    // never left to stand alone, since read in isolation it could imply
    // both installments already happened.
    await expect
      .element(screen.getByText("2 × $700 USD", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByText(
          "First payment of $700 USD received — 1 more payment of $700 USD remaining.",
        ),
      )
      .toBeInTheDocument();
  });

  it("clicking Pay on a real payment option completes the Deal through the real fulfillment path, then shows the completed state", async () => {
    await page.viewport(1280, 900);
    const { dataProvider, screen } = await renderOfferPageRoute(
      buildDeal(),
      "/offer/real-token-123",
    );

    await expect.element(screen.getByText("Pay in Full")).toBeInTheDocument();
    const payButtons = screen.getByRole("button", { name: "Pay" });
    await payButtons.first().click();

    // Dev/demo has no real Stripe to redirect to, so createCheckout
    // completes the Deal directly through the exact same
    // recordDealPaymentSucceeded path a real webhook would eventually
    // reach — proving the click really does something, not a fake
    // illusion.
    await expect
      .element(screen.getByText("Payment received ✓"))
      .toBeInTheDocument();

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: 1,
    });
    expect(deal.stage).toBe("won");
    expect(deal.selected_payment_option_id).toBeTruthy();

    const { data: enrollments } = await dataProvider.getList("enrollments", {
      filter: { opportunity_id: 1 },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(enrollments).toHaveLength(1);
  });
});
