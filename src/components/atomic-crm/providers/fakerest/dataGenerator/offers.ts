import type { Offer, OfferPaymentOption } from "../../../types";

// Leif's real offer catalog. Mirrors the production seed in
// supabase/migrations/20260830130000_offers_cohorts_applications_enrollments.sql
// exactly (same names, ids, prices, payment options) — these are real
// business definitions, not demo/fake data.
export const LIVING_EXAMPLE_OFFER_ID = 1;
export const GYU_OFFER_ID = 2;

export const generateOffers = (): {
  offers: Offer[];
  offerPaymentOptions: OfferPaymentOption[];
} => {
  const now = new Date().toISOString();

  const offers: Offer[] = [
    {
      id: LIVING_EXAMPLE_OFFER_ID,
      name: "The Living Example",
      type: "individual",
      duration: "4 months",
      current_price: 4000,
      // Scholarship Pricing + Capacity slice: locked, Leif-approved total.
      scholarship_price: 3000,
      max_active_clients: 12,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: GYU_OFFER_ID,
      name: "Growing Yourself Up",
      type: "group",
      duration: "8 weeks",
      current_price: 1400,
      scholarship_price: 700,
      max_active_clients: null,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  const offerPaymentOptions: OfferPaymentOption[] = [
    {
      id: 1,
      offer_id: LIVING_EXAMPLE_OFFER_ID,
      name: "Pay in Full",
      total: 4000,
      installments: 1,
      installment_amount: 4000,
      is_public: true,
      pricing_mode: "standard",
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      offer_id: LIVING_EXAMPLE_OFFER_ID,
      name: "Monthly",
      total: 4000,
      installments: 4,
      installment_amount: 1000,
      is_public: true,
      pricing_mode: "standard",
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      offer_id: LIVING_EXAMPLE_OFFER_ID,
      name: "Financial Need",
      total: 3996,
      installments: 6,
      installment_amount: 666,
      is_public: false,
      pricing_mode: "standard",
      created_at: now,
      updated_at: now,
    },
    {
      id: 4,
      offer_id: GYU_OFFER_ID,
      name: "Pay in Full",
      total: 1400,
      installments: 1,
      installment_amount: 1400,
      is_public: true,
      pricing_mode: "standard",
      created_at: now,
      updated_at: now,
    },
    {
      id: 5,
      offer_id: GYU_OFFER_ID,
      name: "Monthly",
      total: 1400,
      installments: 2,
      installment_amount: 700,
      is_public: true,
      pricing_mode: "standard",
      created_at: now,
      updated_at: now,
    },
    {
      id: 6,
      offer_id: GYU_OFFER_ID,
      name: "Financial Need",
      total: 1400,
      installments: 4,
      installment_amount: 350,
      is_public: false,
      pricing_mode: "standard",
      created_at: now,
      updated_at: now,
    },
    // Scholarship Pricing + Capacity slice: locked, Leif-approved
    // scholarship plans — mirrors the production seed migration exactly
    // (20260909100000_scholarship_pricing_and_capacity.sql).
    {
      id: 7,
      offer_id: LIVING_EXAMPLE_OFFER_ID,
      name: "Scholarship — Pay in Full",
      total: 3000,
      installments: 1,
      installment_amount: 3000,
      is_public: true,
      pricing_mode: "scholarship",
      created_at: now,
      updated_at: now,
    },
    {
      id: 8,
      offer_id: LIVING_EXAMPLE_OFFER_ID,
      name: "Scholarship — 3 Installments",
      total: 3000,
      installments: 3,
      installment_amount: 1000,
      is_public: true,
      pricing_mode: "scholarship",
      created_at: now,
      updated_at: now,
    },
    {
      id: 9,
      offer_id: GYU_OFFER_ID,
      name: "Scholarship — Pay in Full",
      total: 700,
      installments: 1,
      installment_amount: 700,
      is_public: true,
      pricing_mode: "scholarship",
      created_at: now,
      updated_at: now,
    },
    {
      id: 10,
      offer_id: GYU_OFFER_ID,
      name: "Scholarship — 2 Installments",
      total: 700,
      installments: 2,
      installment_amount: 350,
      is_public: true,
      pricing_mode: "scholarship",
      created_at: now,
      updated_at: now,
    },
  ];

  return { offers, offerPaymentOptions };
};
