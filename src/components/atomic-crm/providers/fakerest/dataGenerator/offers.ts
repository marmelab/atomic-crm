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
      created_at: now,
      updated_at: now,
    },
  ];

  return { offers, offerPaymentOptions };
};
