import { useGetList, useGetOne } from "ra-core";

import type {
  Cohort,
  Contact,
  Deal,
  Enrollment,
  EnrollmentOffboardingItem,
  EnrollmentOnboardingItem,
  Offer,
  Task,
  DealPaymentScheduleItem,
  DealStripePlanObject,
} from "../types";

// Backs the Enrollment/Client page (Contracts + Onboarding slice, extended
// by the Client Offboarding slice) — same "walk the Opportunity to its
// Contact/Offer/Cohort" shape as useApplicationReviewData.ts, extended
// with both checklists (onboarding and offboarding) and their linked
// Tasks — everything the page needs to be the real fulfillment-lifecycle
// operational home: payment context (from the Deal's own frozen
// snapshot), both checklists, and any Task still open for an incomplete
// item.
export const useEnrollmentOperationalData = (enrollment?: Enrollment) => {
  const { data: deal, isPending: dealPending } = useGetOne<Deal>(
    "deals",
    { id: enrollment?.opportunity_id as Deal["id"] },
    { enabled: enrollment != null },
  );

  const { data: contact, isPending: contactPending } = useGetOne<Contact>(
    "contacts",
    { id: deal?.contact_id as Contact["id"] },
    { enabled: deal?.contact_id != null },
  );

  const { data: offer, isPending: offerPending } = useGetOne<Offer>(
    "offers",
    { id: deal?.offer_id as Offer["id"] },
    { enabled: deal != null },
  );

  const { data: cohort, isPending: cohortPending } = useGetOne<Cohort>(
    "cohorts",
    { id: deal?.cohort_id as Cohort["id"] },
    { enabled: deal?.cohort_id != null },
  );

  // The agreed payment schedule, when this Deal has one. Absent for a
  // simple plan, which still renders from the Deal's own snapshot — see
  // resolveCommercialTerms for which wins.
  //
  // Deliberately NOT part of isPending below. A schedule is supplementary:
  // most Deals have none, and resolveCommercialTerms already treats "no
  // rows" as "fall back to the Deal snapshot". Gating the whole Client page
  // on it meant one slow or failing supplementary query blanked the page —
  // including every operational thing on it that has nothing to do with
  // money. It resolves a moment later and the Payment card re-renders.
  const { data: scheduleItems, isPending: schedulePending } =
    useGetList<DealPaymentScheduleItem>(
      "deal_payment_schedule_items",
      {
        filter: { deal_id: deal?.id },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "sequence", order: "ASC" },
      },
      { enabled: deal != null },
    );

  // Payment truth needs the plan objects to tell a live arrangement from a
  // finished one — a subscription that ended is where earlier payments
  // came from, not proof that paying is over.
  const { data: planObjects } = useGetList<DealStripePlanObject>(
    "deal_stripe_plan_objects",
    {
      filter: { deal_id: deal?.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: deal != null },
  );

  const { data: items, isPending: itemsPending } =
    useGetList<EnrollmentOnboardingItem>(
      "enrollment_onboarding_items",
      {
        filter: { enrollment_id: enrollment?.id },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "sort_order", order: "ASC" },
      },
      { enabled: enrollment != null },
    );

  const { data: offboardingItems, isPending: offboardingItemsPending } =
    useGetList<EnrollmentOffboardingItem>(
      "enrollment_offboarding_items",
      {
        filter: { enrollment_id: enrollment?.id },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "sort_order", order: "ASC" },
      },
      { enabled: enrollment != null },
    );

  const { data: tasks, isPending: tasksPending } = useGetList<Task>(
    "tasks",
    {
      filter: { enrollment_id: enrollment?.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: enrollment != null },
  );

  const isPending =
    enrollment == null ||
    dealPending ||
    (deal?.contact_id != null && contactPending) ||
    offerPending ||
    (deal?.cohort_id != null && cohortPending) ||
    itemsPending ||
    offboardingItemsPending ||
    tasksPending;

  return {
    isPending,
    deal: isPending ? undefined : deal,
    contact: isPending ? undefined : contact,
    offer: isPending ? undefined : offer,
    cohort: deal?.cohort_id != null && !cohortPending ? cohort : undefined,
    items: isPending ? [] : (items ?? []),
    offboardingItems: isPending ? [] : (offboardingItems ?? []),
    tasks: isPending ? [] : (tasks ?? []),
    scheduleItems: schedulePending ? [] : (scheduleItems ?? []),
    planObjects: planObjects ?? [],
  };
};
