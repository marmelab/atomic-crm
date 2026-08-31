// Centralizes every Waitlist Entry status transition (Waitlists slice,
// §11/§12/§13/§19/§25) — the UI only ever calls these, business rules
// never live in a button's onClick. Each re-fetches the entry's current
// state before deciding (never trusts the caller's own possibly-stale
// copy) so a double-click, a cached tab, or Back/Forward can never
// silently re-apply or overwrite a newer transition — mirroring
// applications/reviewApplication.ts's idempotency approach exactly.
import type { DataProvider, Identifier } from "ra-core";

import { isContactDoNotEngage } from "../contacts/doNotEngageGuard";
import type { Deal, Offer, WaitlistEntry } from "../types";
import { syncWaitlistForActiveDeal } from "./waitlistSync";

export type WaitlistTransitionResult =
  | { applied: true }
  | { applied: false; reason: "not-active" | "not-waiting" };

// waiting -> invited. Never creates an Opportunity by itself (§13: Invited
// only means "I offered them the opening" — Converted is a distinct,
// explicit later choice).
export const markInvited = async (
  dataProvider: DataProvider,
  entryId: Identifier,
): Promise<WaitlistTransitionResult> => {
  const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
    "waitlist_entries",
    { id: entryId },
  );
  if (entry.status !== "waiting") {
    return { applied: false, reason: "not-waiting" };
  }

  await dataProvider.update("waitlist_entries", {
    id: entry.id,
    data: { status: "invited", invited_at: new Date().toISOString() },
    previousData: entry,
  });
  return { applied: true };
};

// waiting/invited -> removed. History is preserved (§2/§11): the row
// stays, the Contact and any prior Opportunities are untouched.
export const removeFromWaitlist = async (
  dataProvider: DataProvider,
  entryId: Identifier,
): Promise<WaitlistTransitionResult> => {
  const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
    "waitlist_entries",
    { id: entryId },
  );
  if (entry.status !== "waiting" && entry.status !== "invited") {
    return { applied: false, reason: "not-active" };
  }

  await dataProvider.update("waitlist_entries", {
    id: entry.id,
    data: { status: "removed", removed_at: new Date().toISOString() },
    previousData: entry,
  });
  return { applied: true };
};

export type ConvertToOpportunityResult =
  | { applied: true; dealId: Identifier; reusedExisting: boolean }
  | {
      applied: false;
      reason: "not-active" | "do-not-engage";
    };

// "Active" Opportunity for reuse detection — the same active-pipeline
// definition DealList.tsx's own query already uses (not won, not
// archived, no exit outcome). Deliberately narrow: an Enrollment/past
// Opportunity does not block conversion — only a currently-open one does
// (§12: "If an existing active Opportunity already exists ... do NOT
// create a duplicate").
const isActiveDeal = (deal: Pick<Deal, "stage" | "outcome" | "archived_at">) =>
  deal.archived_at == null && deal.stage !== "won" && deal.outcome == null;

// waiting/invited -> converted. Creates (or reuses) an Opportunity for the
// same Contact + Offer + Cohort, starting at "Interested" — never a later
// stage, since a waitlisted person may not have applied yet, and
// fabricating sales history (Application Received/Approved/Call Booked)
// would misrepresent what actually happened (§12).
export const convertToOpportunity = async (
  dataProvider: DataProvider,
  entryId: Identifier,
): Promise<ConvertToOpportunityResult> => {
  const { data: entry } = await dataProvider.getOne<WaitlistEntry>(
    "waitlist_entries",
    { id: entryId },
  );
  if (entry.status !== "waiting" && entry.status !== "invited") {
    return { applied: false, reason: "not-active" };
  }

  // DNE is a durable "no future direct sales" gate (Native Applications
  // repair pass, §5) — it can't be bypassed just because the waitlist
  // entry predates the Contact becoming DNE.
  if (await isContactDoNotEngage(dataProvider, entry.contact_id)) {
    return { applied: false, reason: "do-not-engage" };
  }

  const { data: existingDeals } = await dataProvider.getList<Deal>("deals", {
    filter: {
      contact_id: entry.contact_id,
      offer_id: entry.offer_id,
      ...(entry.cohort_id != null ? { cohort_id: entry.cohort_id } : {}),
    },
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });
  const existingActiveDeal = existingDeals.find(isActiveDeal);

  let dealId: Identifier;
  let reusedExisting: boolean;

  if (existingActiveDeal) {
    dealId = existingActiveDeal.id;
    reusedExisting = true;
    // Reusing writes nothing to "deals", so dataProvider.ts's centralized
    // afterCreate/afterUpdate sync (waitlistSync.ts) never fires for this
    // path — call it directly, the only place that needs to. It marks
    // THIS entry (and any other compatible one, e.g. a sibling general-
    // Offer-level entry — §4) Converted, so no separate update is needed
    // here.
    await syncWaitlistForActiveDeal(existingActiveDeal, dataProvider);
  } else {
    const { data: offer } = await dataProvider.getOne<Offer>("offers", {
      id: entry.offer_id,
    });
    // The "deals" afterCreate hook (dataProvider.ts) runs
    // syncWaitlistForActiveDeal for the new deal before create() resolves
    // (FakeRest calls are sequential/awaited — see ensureEnrollmentFor-
    // WonDeal's own comment) — this entry is already Converted by the
    // time this call returns; nothing further to do here either.
    const { data: createdDeal } = await dataProvider.create<Deal>("deals", {
      data: {
        contact_id: entry.contact_id,
        offer_id: entry.offer_id,
        cohort_id: entry.cohort_id ?? null,
        stage: "interested",
        outcome: null,
        amount: offer.current_price,
        source: entry.source ?? null,
        description: "",
      },
    });
    dealId = createdDeal.id;
    reusedExisting = false;
  }

  return { applied: true, dealId, reusedExisting };
};
