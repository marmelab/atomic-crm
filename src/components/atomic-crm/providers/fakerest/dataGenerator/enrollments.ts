import type { Enrollment } from "../../../types";
import type { Db } from "./types";

// Any Won Opportunity should have exactly one Enrollment — this is what the
// handle_deal_won() trigger / dataProvider lifecycle hook guarantees for a
// live Won transition. The randomly generated Living Example deals in
// deals.ts are seeded already-Won (never went through that live path), so
// backfill their Enrollment here. Named fixtures that already pushed their
// own Enrollment (see leifProofSliceFixtures.ts) are skipped.
//
// Contracts + Onboarding slice: also seeds each backfilled Enrollment's own
// enrollment_onboarding_items (mirrors handle_deal_won()'s snapshot logic)
// so the initial demo dataset's Clients/Enrollment pages show a real
// checklist, not an empty one. Deliberately does NOT also create Tasks
// here — db.tasks is fully replaced by generateTasks(db) later in
// dataGenerator/index.ts's own sequencing, which would silently discard
// anything pushed onto it at this point. A real, LIVE Won transition
// during a session (ensureEnrollmentForWonDeal below, dataProvider-based)
// creates both items and Tasks correctly; this backfill only needs to
// avoid an empty checklist in the seeded demo data.
export const backfillEnrollmentsForWonDeals = (db: Db): void => {
  const enrolledOpportunityIds = new Set(
    db.enrollments.map((enrollment) => enrollment.opportunity_id),
  );
  let nextEnrollmentId =
    db.enrollments.reduce(
      (max, enrollment) => Math.max(max, enrollment.id as number),
      -1,
    ) + 1;
  let nextItemId =
    db.enrollment_onboarding_items.reduce(
      (max, item) => Math.max(max, item.id as number),
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
        id: nextEnrollmentId++,
        opportunity_id: deal.id,
        status: "onboarding",
        start_date: cohort?.program_start_at?.split("T")[0] ?? null,
        end_date: cohort?.program_end_at?.split("T")[0] ?? null,
        created_at: now,
        updated_at: now,
      };
      db.enrollments.push(enrollment);
      enrolledOpportunityIds.add(deal.id);

      db.onboarding_requirement_templates
        .filter(
          (template) =>
            String(template.offer_id) === String(deal.offer_id) &&
            template.is_active,
        )
        .forEach((template) => {
          db.enrollment_onboarding_items.push({
            id: nextItemId++,
            enrollment_id: enrollment.id,
            requirement_key: template.key,
            label: template.label,
            task_text_template: template.task_text_template,
            is_required: template.is_required,
            sort_order: template.sort_order,
            status: "pending",
            completed_at: null,
            external_ref: null,
            created_at: now,
            updated_at: now,
          });
        });
    });
};
