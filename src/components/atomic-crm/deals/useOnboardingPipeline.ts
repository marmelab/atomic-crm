import { useGetList } from "ra-core";
import { useMemo } from "react";

import type {
  Deal,
  DealPaymentScheduleItem,
  DealStripePlanObject,
  Enrollment,
  EnrollmentOnboardingItem,
} from "../types";
import { assessPostSaleSetup, type PostSaleSetup } from "./postSaleSetup";

// The Onboarding column: everyone who has said yes and still has setup work.
//
// Won is the sales outcome and it never moves again. Onboarding is the
// temporary operational stage that follows it, and an Opportunity leaves
// the board by FINISHING that work — not by being dragged somewhere. Once
// the contract is signed, access is granted and the payment arrangement
// exists, the card is simply gone and the person lives under Clients.
//
// Everything is fetched in bulk. Asking per Opportunity would be sixty-odd
// round trips to draw one column.
export type OnboardingPipeline = {
  deals: Deal[];
  setupByDeal: Record<string, PostSaleSetup>;
  isPending: boolean;
};

const EMPTY: OnboardingPipeline = {
  deals: [],
  setupByDeal: {},
  isPending: true,
};

export const useOnboardingPipeline = (): OnboardingPipeline => {
  const { data: wonDeals, isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      filter: { stage: "won" },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const { data: enrollments } = useGetList<Enrollment>("enrollments", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "id", order: "ASC" },
  });

  const { data: onboardingItems } = useGetList<EnrollmentOnboardingItem>(
    "enrollment_onboarding_items",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const { data: scheduleItems } = useGetList<DealPaymentScheduleItem>(
    "deal_payment_schedule_items",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "sequence", order: "ASC" },
    },
  );

  const { data: planObjects } = useGetList<DealStripePlanObject>(
    "deal_stripe_plan_objects",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
    },
  );

  return useMemo(() => {
    if (!wonDeals) return { ...EMPTY, isPending: dealsPending };

    const enrollmentByDeal = new Map<string, Enrollment>();
    for (const enrollment of enrollments ?? []) {
      enrollmentByDeal.set(String(enrollment.opportunity_id), enrollment);
    }

    const itemsByEnrollment = new Map<string, EnrollmentOnboardingItem[]>();
    for (const item of onboardingItems ?? []) {
      const key = String(item.enrollment_id);
      itemsByEnrollment.set(key, [...(itemsByEnrollment.get(key) ?? []), item]);
    }

    const scheduleByDeal = new Map<string, DealPaymentScheduleItem[]>();
    for (const item of scheduleItems ?? []) {
      const key = String(item.deal_id);
      scheduleByDeal.set(key, [...(scheduleByDeal.get(key) ?? []), item]);
    }

    const plansByDeal = new Map<string, DealStripePlanObject[]>();
    for (const plan of planObjects ?? []) {
      const key = String(plan.deal_id);
      plansByDeal.set(key, [...(plansByDeal.get(key) ?? []), plan]);
    }

    const deals: Deal[] = [];
    const setupByDeal: Record<string, PostSaleSetup> = {};

    for (const deal of wonDeals) {
      if (deal.archived_at != null) continue;
      const key = String(deal.id);
      const enrollment = enrollmentByDeal.get(key);

      // A synthetic view of REAL post-sale work: an actual Won sale with a
      // live client relationship behind it. An Opportunity with no
      // Enrollment never completed a sale, whatever its stage value says —
      // which is what keeps the fourteen dormant records that were
      // mechanically renamed from "committed" off the active board.
      if (!enrollment) continue;

      const setup = assessPostSaleSetup({
        deal,
        enrollmentStatus: enrollment?.status ?? null,
        enrollmentOnboardingTracking: enrollment?.onboarding_tracking ?? null,
        scheduleItems: scheduleByDeal.get(key) ?? [],
        planObjects: plansByDeal.get(key) ?? [],
        onboardingItems: enrollment
          ? (itemsByEnrollment.get(String(enrollment.id)) ?? [])
          : [],
      });

      // Finished setup means finished with the board. Nothing about the
      // sale, the Enrollment or the history changes — the card is simply
      // no longer work.
      if (setup.complete) continue;

      deals.push(deal);
      setupByDeal[key] = setup;
    }

    return { deals, setupByDeal, isPending: false };
  }, [
    wonDeals,
    enrollments,
    onboardingItems,
    scheduleItems,
    planObjects,
    dealsPending,
  ]);
};
