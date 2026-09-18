import { useGetList, useGetMany } from "ra-core";
import type { Identifier } from "ra-core";

import type {
  Deal,
  Contact,
  Enrollment,
  EnrollmentOnboardingItem,
  DealPaymentScheduleItem,
} from "../types";
import { assessPaymentTruth, type PaymentTruth } from "../deals/paymentTruth";
import type { DealStripePlanObject } from "../types";

export type NeedsOnboardingRow = {
  enrollmentId: Identifier;
  contactName: string;
  offerName: string;
  // What this person agreed to and what has actually been collected,
  // from the one canonical model every other surface reads.
  payment: PaymentTruth;
  requiredDone: number;
  requiredTotal: number;
};

// Contracts + Onboarding slice: the Dashboard's primary "this person cannot
// disappear" signal (architecture review, §1/§9) — reads directly off
// Enrollment state, not Tasks, so it stays correct whether or not any Task
// happens to exist. Sorted oldest-first (enrollment created_at ascending)
// so a long-stalled onboarding surfaces at the top — the same "age in
// onboarding" signal the review recommended instead of a new status/column.
export const useNeedsOnboardingItems = (): {
  isPending: boolean;
  rows: NeedsOnboardingRow[];
} => {
  const { data: enrollments, isPending: enrollmentsPending } =
    useGetList<Enrollment>("enrollments", {
      filter: { status: "onboarding" },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "created_at", order: "ASC" },
    });

  const dealIds = [
    ...new Set((enrollments ?? []).map((e) => e.opportunity_id)),
  ];
  const { data: deals, isPending: dealsPending } = useGetMany<Deal>(
    "deals",
    { ids: dealIds },
    { enabled: dealIds.length > 0 },
  );

  const contactIds = [
    ...new Set(
      (deals ?? [])
        .map((deal) => deal.contact_id)
        .filter((id): id is Identifier => id != null),
    ),
  ];
  const { data: contacts, isPending: contactsPending } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );

  // Paid-to-date lives in the payment schedule, never in the Deal snapshot
  // (which records what was AGREED).
  const { data: scheduleItems, isPending: schedulePending } =
    useGetList<DealPaymentScheduleItem>(
      "deal_payment_schedule_items",
      {
        filter: { "deal_id@in": `(${dealIds.join(",")})` },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "sequence", order: "ASC" },
      },
      { enabled: dealIds.length > 0 },
    );

  // The plan objects payment truth needs to tell a live arrangement from
  // a finished one.
  const { data: planObjects } = useGetList<DealStripePlanObject>(
    "deal_stripe_plan_objects",
    {
      filter: { "deal_id@in": `(${dealIds.join(",")})` },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: dealIds.length > 0 },
  );

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  const { data: items, isPending: itemsPending } =
    useGetList<EnrollmentOnboardingItem>(
      "enrollment_onboarding_items",
      {
        filter: { "enrollment_id@in": `(${enrollmentIds.join(",")})` },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: enrollmentIds.length > 0 },
    );

  const isPending =
    enrollmentsPending ||
    (dealIds.length > 0 && dealsPending) ||
    (contactIds.length > 0 && contactsPending) ||
    (enrollmentIds.length > 0 && itemsPending) ||
    (dealIds.length > 0 && schedulePending);

  if (isPending) return { isPending: true, rows: [] };

  const dealById = new Map((deals ?? []).map((d) => [String(d.id), d]));
  const contactById = new Map((contacts ?? []).map((c) => [String(c.id), c]));

  const rows: NeedsOnboardingRow[] = (enrollments ?? []).map((enrollment) => {
    const deal = dealById.get(String(enrollment.opportunity_id));
    const contact = deal?.contact_id
      ? contactById.get(String(deal.contact_id))
      : undefined;
    const enrollmentItems = (items ?? []).filter(
      (item) => String(item.enrollment_id) === String(enrollment.id),
    );
    const requiredItems = enrollmentItems.filter((item) => item.is_required);
    return {
      enrollmentId: enrollment.id,
      contactName: contact
        ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
        : (deal?.name ?? ""),
      offerName: deal?.offer_name_snapshot ?? "",
      payment: assessPaymentTruth({
        deal: deal ?? ({ id: enrollment.opportunity_id, stage: "" } as never),
        scheduleItems: (scheduleItems ?? []).filter(
          (item) => String(item.deal_id) === String(deal?.id),
        ),
        planObjects: (planObjects ?? []).filter(
          (object) => String(object.deal_id) === String(deal?.id),
        ),
      }),
      requiredDone: requiredItems.filter((item) => item.status === "done")
        .length,
      requiredTotal: requiredItems.length,
    };
  });

  return { isPending: false, rows };
};
