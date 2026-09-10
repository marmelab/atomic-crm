import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type {
  Deal,
  Offer,
  OfferPaymentOption,
  ScholarshipSlot,
} from "../types";
import { grantScholarshipPricing } from "./grantScholarshipPricing";
import { releaseScholarshipReservation } from "./releaseScholarshipReservation";

// Scholarship Pricing + Capacity slice: mirrors the real Postgres trigger
// mechanism (handle_deal_saved()/handle_deal_won()/
// handle_enrollment_scholarship_slot_transition() — supabase/schemas/
// 02_functions.sql) via its FakeRest twin (scholarshipSlotValidation.ts).
// FakeRest is single-threaded/sequential, so it cannot itself prove
// concurrency safety under genuinely simultaneous requests — that proof
// was run separately against the real linked Postgres project (see the
// session's own real-infrastructure proof). These tests instead prove the
// business RULES are identical in both places: exactly one holder per
// Offer, the correct transitions, and the correct rejections.

const LE_OFFER_ID = 1;
const CONTACT_A = 1;
const CONTACT_B = 2;
const DEAL_A = 10;
const DEAL_B = 11;
const NOW = "2026-01-01T00:00:00.000Z";

const buildOffer = (overrides: Partial<Offer> = {}): Offer => ({
  id: LE_OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  scholarship_price: 3000,
  max_active_clients: 12,
  is_active: true,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

const buildDeal = (
  id: number,
  contactId: number,
  overrides: Partial<Deal> = {},
): Deal => ({
  pricing_mode: "standard",
  id,
  name: "Test Person",
  contact_id: contactId,
  offer_id: LE_OFFER_ID,
  stage: "committed",
  outcome: null,
  amount: 4000,
  offer_name_snapshot: "The Living Example",
  offer_price_snapshot: 4000,
  created_at: NOW,
  updated_at: NOW,
  sales_id: 0,
  index: 0,
  stage_entered_at: NOW,
  ...overrides,
});

const buildOption = (
  overrides: Partial<OfferPaymentOption> & Pick<OfferPaymentOption, "id">,
): OfferPaymentOption => ({
  offer_id: LE_OFFER_ID,
  name: "Pay in Full",
  total: 4000,
  installments: 1,
  installment_amount: 4000,
  is_public: true,
  pricing_mode: "standard",
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

const PAYMENT_OPTIONS: OfferPaymentOption[] = [
  buildOption({
    id: 1,
    name: "Pay in Full",
    total: 4000,
    installments: 1,
    installment_amount: 4000,
  }),
  buildOption({
    id: 3,
    name: "Financial Need",
    total: 3996,
    installments: 6,
    installment_amount: 666,
    is_public: false,
  }),
  buildOption({
    id: 7,
    name: "Scholarship — Pay in Full",
    total: 3000,
    installments: 1,
    installment_amount: 3000,
    pricing_mode: "scholarship",
  }),
  buildOption({
    id: 8,
    name: "Scholarship — 3 Installments",
    total: 3000,
    installments: 3,
    installment_amount: 1000,
    pricing_mode: "scholarship",
  }),
];

const buildFixtures = (
  dealOverridesA: Partial<Deal> = {},
  dealOverridesB: Partial<Deal> = {},
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({
          id: CONTACT_A,
          first_name: "Ada",
          last_name: "Lovelace",
        }),
        buildContact({
          id: CONTACT_B,
          first_name: "Grace",
          last_name: "Hopper",
        }),
      ],
      offers: [buildOffer()],
      offer_payment_options: PAYMENT_OPTIONS,
      deals: [
        buildDeal(DEAL_A, CONTACT_A, dealOverridesA),
        buildDeal(DEAL_B, CONTACT_B, dealOverridesB),
      ],
      enrollments: [],
    } as any),
    silent: true,
  });
  return { dataProvider };
};

const getSlot = async (dataProvider: ReturnType<typeof createDataProvider>) => {
  const { data } = await dataProvider.getList<ScholarshipSlot>(
    "scholarship_slots",
    {
      filter: { offer_id: LE_OFFER_ID },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
  );
  return data[0] ?? null;
};

describe("Scholarship Pricing + Capacity", () => {
  it("grants scholarship pricing, freezes the scholarship price, and appends an audit event", async () => {
    const { dataProvider } = buildFixtures();

    const result = await grantScholarshipPricing(dataProvider, DEAL_A);
    expect(result.status).toBe("granted");

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    expect(deal.pricing_mode).toBe("scholarship");
    expect(deal.offer_price_snapshot).toBe(3000);
    expect(deal.amount).toBe(3000);

    const slot = await getSlot(dataProvider);
    expect(slot?.holder_deal_id).toBe(DEAL_A);
    expect(slot?.holder_enrollment_id ?? null).toBeNull();

    const { data: events } = await dataProvider.getList(
      "scholarship_slot_events",
      {
        filter: { offer_id: LE_OFFER_ID },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(events.map((e) => e.event_type)).toEqual(["scholarship_granted"]);
  });

  it("rejects a second grant for the same Offer while one is outstanding, leaving the loser standard", async () => {
    const { dataProvider } = buildFixtures();
    await grantScholarshipPricing(dataProvider, DEAL_A);

    const result = await grantScholarshipPricing(dataProvider, DEAL_B);
    expect(result.status).toBe("slot-unavailable");
    if (result.status === "slot-unavailable") {
      expect(result.heldByDescription).toMatch(/Ada Lovelace/);
    }

    const { data: dealB } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_B,
    });
    expect(dealB.pricing_mode).toBe("standard");

    const slot = await getSlot(dataProvider);
    expect(slot?.holder_deal_id).toBe(DEAL_A);
  });

  it("releases a granted reservation, re-freezing the standard price, and frees the slot for another Deal", async () => {
    const { dataProvider } = buildFixtures();
    await grantScholarshipPricing(dataProvider, DEAL_A);

    const releaseResult = await releaseScholarshipReservation(
      dataProvider,
      DEAL_A,
    );
    expect(releaseResult.status).toBe("released");

    const { data: dealA } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    expect(dealA.pricing_mode).toBe("standard");
    expect(dealA.offer_price_snapshot).toBe(4000);
    expect(dealA.amount).toBe(4000);

    const slotAfterRelease = await getSlot(dataProvider);
    expect(slotAfterRelease?.holder_deal_id ?? null).toBeNull();

    const grantB = await grantScholarshipPricing(dataProvider, DEAL_B);
    expect(grantB.status).toBe("granted");
    const slotAfterB = await getSlot(dataProvider);
    expect(slotAfterB?.holder_deal_id).toBe(DEAL_B);
  });

  it("rejects releasing a scholarship Deal that has already reached Won (pricing_mode is frozen)", async () => {
    const { dataProvider } = buildFixtures();
    await grantScholarshipPricing(dataProvider, DEAL_A);
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    await dataProvider.update("deals", {
      id: DEAL_A,
      data: { stage: "won" },
      previousData: deal,
    });

    const releaseResult = await releaseScholarshipReservation(
      dataProvider,
      DEAL_A,
    );
    expect(releaseResult.status).toBe("already-won");

    // The DB-level immutability guard rejects a direct attempt too.
    const { data: wonDeal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    await expect(
      dataProvider.update("deals", {
        id: DEAL_A,
        data: { pricing_mode: "standard" },
        previousData: wonDeal,
      }),
    ).rejects.toThrow(/once it has reached Won/);
  });

  it("transitions the slot from Deal-held to Enrollment-held the moment a scholarship Deal reaches Won", async () => {
    const { dataProvider } = buildFixtures();
    await grantScholarshipPricing(dataProvider, DEAL_A);
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });

    await dataProvider.update("deals", {
      id: DEAL_A,
      data: { stage: "won" },
      previousData: deal,
    });

    const { data: enrollments } = await dataProvider.getList("enrollments", {
      filter: { opportunity_id: DEAL_A },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    const enrollment = enrollments[0];
    expect(enrollment).toBeTruthy();

    const slot = await getSlot(dataProvider);
    expect(slot?.holder_deal_id ?? null).toBeNull();
    expect(slot?.holder_enrollment_id).toBe(enrollment.id);

    const { data: events } = await dataProvider.getList(
      "scholarship_slot_events",
      {
        filter: { offer_id: LE_OFFER_ID },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(events.map((e) => e.event_type)).toEqual([
      "scholarship_granted",
      "deal_converted_to_enrollment",
    ]);

    return { enrollment };
  });

  it("frees the slot when the Enrollment completes, letting a new Deal acquire it", async () => {
    const { dataProvider } = buildFixtures();
    await grantScholarshipPricing(dataProvider, DEAL_A);
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    await dataProvider.update("deals", {
      id: DEAL_A,
      data: { stage: "won" },
      previousData: deal,
    });

    const {
      data: [enrollment],
    } = await dataProvider.getList("enrollments", {
      filter: { opportunity_id: DEAL_A },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });

    // Walk the lifecycle forward: onboarding -> active -> offboarding -> completed.
    for (const status of ["active", "offboarding", "completed"]) {
      const { data: current } = await dataProvider.getOne("enrollments", {
        id: enrollment.id,
      });
      await dataProvider.update("enrollments", {
        id: enrollment.id,
        data: { status },
        previousData: current,
      });
    }

    const slotAfterCompletion = await getSlot(dataProvider);
    expect(slotAfterCompletion?.holder_deal_id ?? null).toBeNull();
    expect(slotAfterCompletion?.holder_enrollment_id ?? null).toBeNull();

    const grantB = await grantScholarshipPricing(dataProvider, DEAL_B);
    expect(grantB.status).toBe("granted");
  }, 30000);

  it("reclaims the slot on a backward correction off of completed when the slot is free", async () => {
    const { dataProvider } = buildFixtures();
    await grantScholarshipPricing(dataProvider, DEAL_A);
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    await dataProvider.update("deals", {
      id: DEAL_A,
      data: { stage: "won" },
      previousData: deal,
    });
    const {
      data: [enrollment],
    } = await dataProvider.getList("enrollments", {
      filter: { opportunity_id: DEAL_A },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    for (const status of ["active", "offboarding", "completed"]) {
      const { data: current } = await dataProvider.getOne("enrollments", {
        id: enrollment.id,
      });
      await dataProvider.update("enrollments", {
        id: enrollment.id,
        data: { status },
        previousData: current,
      });
    }

    // Backward correction: completed -> offboarding, slot is currently free.
    const { data: completed } = await dataProvider.getOne("enrollments", {
      id: enrollment.id,
    });
    await dataProvider.update("enrollments", {
      id: enrollment.id,
      data: { status: "offboarding" },
      previousData: completed,
    });

    const slot = await getSlot(dataProvider);
    expect(slot?.holder_enrollment_id).toBe(enrollment.id);
  });

  it("rejects a backward correction off of completed when another holder has since claimed the slot", async () => {
    const { dataProvider } = buildFixtures();
    await grantScholarshipPricing(dataProvider, DEAL_A);
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    await dataProvider.update("deals", {
      id: DEAL_A,
      data: { stage: "won" },
      previousData: deal,
    });
    const {
      data: [enrollment],
    } = await dataProvider.getList("enrollments", {
      filter: { opportunity_id: DEAL_A },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    for (const status of ["active", "offboarding", "completed"]) {
      const { data: current } = await dataProvider.getOne("enrollments", {
        id: enrollment.id,
      });
      await dataProvider.update("enrollments", {
        id: enrollment.id,
        data: { status },
        previousData: current,
      });
    }

    // Someone else claims the now-free slot.
    const grantB = await grantScholarshipPricing(dataProvider, DEAL_B);
    expect(grantB.status).toBe("granted");

    // The backward correction must now be rejected, and the Enrollment must
    // stay completed — never silently displacing Deal B's holder.
    const { data: completed } = await dataProvider.getOne("enrollments", {
      id: enrollment.id,
    });
    await expect(
      dataProvider.update("enrollments", {
        id: enrollment.id,
        data: { status: "offboarding" },
        previousData: completed,
      }),
    ).rejects.toThrow(/already held by another/);

    const { data: stillCompleted } = await dataProvider.getOne("enrollments", {
      id: enrollment.id,
    });
    expect(stillCompleted.status).toBe("completed");
  }, 30000);

  it("scopes payment options to pricing_mode — standard Financial Need never appears for a scholarship Deal", async () => {
    const { dataProvider } = buildFixtures();
    await grantScholarshipPricing(dataProvider, DEAL_A);

    const { getOfferPageContext } = await import("./publicOfferPageContext");
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    await dataProvider.update("deals", {
      id: DEAL_A,
      data: { offer_page_token: "test-token" },
      previousData: deal,
    });

    const context = await getOfferPageContext(dataProvider, "test-token");
    expect(context.kind).toBe("found");
    if (context.kind === "found") {
      expect(context.isScholarship).toBe(true);
      const names = context.paymentOptions.map((o) => o.name).sort();
      expect(names).toEqual([
        "Scholarship — 3 Installments",
        "Scholarship — Pay in Full",
      ]);
    }
  });

  it("rejects a mismatched payment option at the domain/DB validation layer", async () => {
    const { dataProvider } = buildFixtures();
    await grantScholarshipPricing(dataProvider, DEAL_A);
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });

    // Option 1 is a STANDARD option; deal is scholarship — must be rejected.
    await expect(
      dataProvider.update("deals", {
        id: DEAL_A,
        data: { selected_payment_option_id: 1 },
        previousData: deal,
      }),
    ).rejects.toThrow(/does not match deal/);

    // The correct scholarship option succeeds.
    const { data: current } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    const { data: updated } = await dataProvider.update("deals", {
      id: DEAL_A,
      data: { selected_payment_option_id: 8 },
      previousData: current,
    });
    expect(updated.selected_payment_total).toBe(3000);
    expect(updated.selected_installment_count).toBe(3);
    expect(updated.selected_installment_amount).toBe(1000);
  });

  it("clears a stale scholarship-only payment option when releasing back to standard (real-infrastructure regression)", async () => {
    // Found against the real linked Postgres project: granting scholarship,
    // selecting a scholarship-only payment option, then releasing back to
    // standard used to fail outright — the DB's own cross-validation
    // rejected the release because the now-stale scholarship option was
    // still selected. Fixed by clearing it in the SAME write.
    const { dataProvider } = buildFixtures();
    await grantScholarshipPricing(dataProvider, DEAL_A);
    const { data: withScholarship } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    await dataProvider.update("deals", {
      id: DEAL_A,
      data: { selected_payment_option_id: 8 },
      previousData: withScholarship,
    });

    const releaseResult = await releaseScholarshipReservation(
      dataProvider,
      DEAL_A,
    );
    expect(releaseResult.status).toBe("released");

    const { data: released } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    expect(released.pricing_mode).toBe("standard");
    expect(released.selected_payment_option_id ?? null).toBeNull();
    expect(released.selected_payment_total ?? null).toBeNull();
  });

  it("clears a stale standard-only payment option when granting scholarship (real-infrastructure regression, reverse direction)", async () => {
    const { dataProvider } = buildFixtures();
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    await dataProvider.update("deals", {
      id: DEAL_A,
      data: { selected_payment_option_id: 1 },
      previousData: deal,
    });

    const grantResult = await grantScholarshipPricing(dataProvider, DEAL_A);
    expect(grantResult.status).toBe("granted");

    const { data: granted } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    expect(granted.pricing_mode).toBe("scholarship");
    expect(granted.selected_payment_option_id ?? null).toBeNull();
  });

  it("keeps Potential Value (amount) in sync with the frozen commercial terms on grant and release (human-acceptance regression)", async () => {
    // Found during human acceptance: a real scholarship Deal (frozen at
    // $3,000) displayed "Potential Value: $0.00" on both the Kanban card
    // and the Opportunity lightbox, because granting/releasing scholarship
    // never touched `amount` — only the edit FORM's own effect
    // (resolveOpportunityAmount.ts) keeps it in sync, and the dedicated
    // grant/release action deliberately bypasses that form. Fixed by
    // setting `amount` directly in the same write.
    const { dataProvider } = buildFixtures();
    const { data: before } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    expect(before.amount).toBe(4000);

    await grantScholarshipPricing(dataProvider, DEAL_A);
    const { data: granted } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    expect(granted.amount).toBe(3000);

    await releaseScholarshipReservation(dataProvider, DEAL_A);
    const { data: released } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_A,
    });
    expect(released.amount).toBe(4000);
  });

  it("rejects granting scholarship when the Offer has no scholarship price configured", async () => {
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [buildContact({ id: CONTACT_A })],
        offers: [buildOffer({ scholarship_price: null })],
        offer_payment_options: PAYMENT_OPTIONS,
        deals: [buildDeal(DEAL_A, CONTACT_A)],
      } as any),
      silent: true,
    });

    const result = await grantScholarshipPricing(dataProvider, DEAL_A);
    expect(result.status).toBe("no-scholarship-price-configured");
  });
});
