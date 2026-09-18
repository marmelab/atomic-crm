import type { DataProvider, Identifier } from "ra-core";

import type { Deal } from "../types";
import { closeSalesDecisionTasks } from "./closeSalesTasks";

// Yes or No, in Leif's words.
//
// The previous version offered Committed / Declined offer / Ghosted, which
// are CRM stages wearing human clothes: it made Leif decide what the
// internal model should do rather than telling the CRM what happened.
//
// YES means the sale was accepted. That is a SALES fact and nothing else,
// so it sets Won and stops there.
//
// An earlier draft of this gated Won on payment authority — Won only if a
// Stripe subscription or a recorded payment already existed, Committed
// otherwise. That is wrong, and four live clients proved it: Denise
// Cormier, Ava Frotton, Linda Turner and Emma Wijns were all stuck at
// Committed with no Enrollment, one of them PAID IN FULL and another
// already onboarded, purely because the CRM had not created their Stripe
// plan itself. Gating the sale on the payment plumbing made the CRM
// disagree with the business about who its clients were.
//
// These are four independent dimensions, and none of them may overwrite
// another:
//
//   sales outcome   did they say yes            -> deals.stage / outcome
//   payment         what has been agreed/paid   -> schedule items, Stripe
//   enrollment      are they in the programme    -> enrollments
//   onboarding      is their setup done          -> checklist items
//
// So Won does NOT mean paid in full, does not mean a subscription is
// active, and does not mean onboarding is complete. Payment remains
// visible and actionable in the drawer as its own outstanding work.
//
// NO hands straight to the same canonical reason flow as the Remove from
// pipeline action — one exit machinery, not two.
export type SalesDecisionResult =
  | { status: "won" }
  | { status: "not-found" }
  // Already out of the pipeline, or already Won. A second click or a stale
  // tab is a safe no-op, never a second write.
  | { status: "already-resolved" };

export const recordYes = async (
  dataProvider: DataProvider,
  { opportunityId }: { opportunityId: Identifier },
): Promise<SalesDecisionResult> => {
  const { data: deal } = await dataProvider
    .getOne<Deal>("deals", { id: opportunityId })
    .catch(() => ({ data: null as Deal | null }));
  if (!deal) return { status: "not-found" };

  if (
    deal.archived_at != null ||
    deal.outcome != null ||
    deal.stage === "won"
  ) {
    return { status: "already-resolved" };
  }

  await dataProvider.update<Deal>("deals", {
    id: deal.id,
    data: {
      stage: "won",
      stage_entered_at: new Date().toISOString(),
      prospect_decision: "yes",
    },
    previousData: deal,
  });

  // Gil's "follow up on Sep 22" existed because nobody knew what he
  // would decide. Now somebody does.
  await closeSalesDecisionTasks(
    dataProvider,
    deal.contact_id,
    new Date().toISOString(),
  );

  // The Enrollment follows from Won on the database side
  // (handle_deal_won(), idempotent on enrollments.opportunity_id), so the
  // client container and its onboarding checklist appear without this
  // action needing to know how either works.
  return { status: "won" };
};
