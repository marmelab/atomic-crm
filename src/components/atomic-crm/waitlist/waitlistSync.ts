// Centralizes the Waitlist <-> Opportunity consistency invariant (Human-
// acceptance repair pass, §4/§5): a Contact cannot stay Waiting/Invited for
// a relationship they already have an active Opportunity for — Sarah Jones
// had an Approved Opportunity while her Living Example entry still said
// Waiting, because nothing but the Waitlist's OWN "Convert to Opportunity"
// button ever flipped an entry, and an Opportunity created or advanced
// through any other path (New Opportunity, an Application, drag-and-drop
// on the Kanban, a future integration) never went through it.
//
// This is wired into dataProvider.ts's ONE "deals" resource's
// afterCreate/afterUpdate lifecycle callbacks — every write to a Deal,
// regardless of which UI screen made it, funnels through those two hooks,
// so this is the single place the invariant is enforced (never scattered
// "also update the waitlist" calls across individual pages).
// waitlistActions.ts's own convertToOpportunity calls this directly too
// (its reuse-existing-deal branch writes nothing to "deals", so the
// dataProvider hook never fires for it) — see that file's own comment.
import type { DataProvider } from "ra-core";

import type { Deal, WaitlistEntry } from "../types";
import { ACTIVE_WAITLIST_STATUSES } from "./waitlistConstants";

// A Deal "establishes an active sales relationship" once it exists without
// having exited — archived or given an exit outcome (needs_higher_care /
// not_fit / nurture / lost). Deliberately broader than waitlistActions.ts's
// own isActiveDeal (which excludes Won, for a DIFFERENT purpose — deciding
// whether to reuse a deal instead of creating a duplicate): a Won deal is
// certainly not "still waiting" either, so it must still convert any
// compatible entry.
const establishesActiveSalesRelationship = (
  deal: Pick<Deal, "archived_at" | "outcome">,
) => deal.archived_at == null && deal.outcome == null;

// Compatible = same Contact + Offer, and:
// - a cohort-specific entry (cohort_id set) matches only that exact Cohort
//   ("a September-specific waitlist because the person has a November
//   Opportunity" must NOT convert), or
// - an offer-level entry (cohort_id null — "I want this generally") is
//   satisfied by ANY cohort of that Offer, since that's what "generally"
//   meant, and trivially by an individual Offer's own null cohort (LE).
const isCompatible = (entry: WaitlistEntry, deal: Deal) =>
  entry.contact_id === deal.contact_id &&
  entry.offer_id === deal.offer_id &&
  (entry.cohort_id == null || entry.cohort_id === deal.cohort_id);

// Finds every active Waitlist Entry compatible with this Deal and marks
// them Converted, linked to it. Idempotent (only touches entries still
// waiting/invited) and safe to call redundantly — a no-op once every
// compatible entry is already Converted.
export const syncWaitlistForActiveDeal = async (
  deal: Deal,
  dataProvider: DataProvider,
): Promise<void> => {
  if (!establishesActiveSalesRelationship(deal)) return;

  const { data: entries } = await dataProvider.getList<WaitlistEntry>(
    "waitlist_entries",
    {
      filter: { contact_id: deal.contact_id, offer_id: deal.offer_id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const compatible = entries.filter(
    (entry) =>
      ACTIVE_WAITLIST_STATUSES.has(entry.status) && isCompatible(entry, deal),
  );
  if (compatible.length === 0) return;

  const convertedAt = new Date().toISOString();
  await Promise.all(
    compatible.map((entry) =>
      dataProvider.update("waitlist_entries", {
        id: entry.id,
        data: {
          status: "converted",
          converted_at: convertedAt,
          converted_opportunity_id: deal.id,
        },
        previousData: entry,
      }),
    ),
  );
};
