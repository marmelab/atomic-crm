import type { Enrollment } from "../../../types";
import type { Db } from "./types";

// Any Won Opportunity should have exactly one Enrollment — this is what the
// handle_deal_won() trigger / dataProvider lifecycle hook guarantees for a
// live Won transition. The randomly generated Living Example deals in
// deals.ts are seeded already-Won (never went through that live path), so
// backfill their Enrollment here. Named fixtures that already pushed their
// own Enrollment (see leifProofSliceFixtures.ts) are skipped.
export const backfillEnrollmentsForWonDeals = (db: Db): void => {
  const enrolledOpportunityIds = new Set(
    db.enrollments.map((enrollment) => enrollment.opportunity_id),
  );
  let nextId =
    db.enrollments.reduce(
      (max, enrollment) => Math.max(max, enrollment.id as number),
      -1,
    ) + 1;
  const now = new Date().toISOString();

  db.deals
    .filter(
      (deal) => deal.stage === "won" && !enrolledOpportunityIds.has(deal.id),
    )
    .forEach((deal) => {
      const cohort = deal.cohort_id
        ? db.cohorts.find((c) => c.id === deal.cohort_id)
        : undefined;
      const enrollment: Enrollment = {
        id: nextId++,
        opportunity_id: deal.id,
        status: "onboarding",
        start_date: cohort?.program_start_at?.split("T")[0] ?? null,
        end_date: cohort?.program_end_at?.split("T")[0] ?? null,
        created_at: now,
        updated_at: now,
      };
      db.enrollments.push(enrollment);
      enrolledOpportunityIds.add(deal.id);
    });
};
