// Shared validation for Waitlist Entries (Waitlists slice, §4/§19),
// enforced identically wherever an entry can be created — the FakeRest
// lifecycle hook (dataProvider.ts) and the addToWaitlist domain action
// both call this, mirroring how offerCohortValidation.ts is shared between
// FakeRest and the UI's understanding of the same rule the Postgres
// trigger enforces (handle_waitlist_entry_saved()). The real DB's partial
// unique index (waitlist_entries_active_unique_idx) is defense-in-depth
// for direct SQL/races — FakeRest has no constraint engine at all, so this
// function is the *only* thing that can enforce the rule there.
import type { DataProvider, Identifier } from "ra-core";

import type { WaitlistEntry } from "../types";
import { ACTIVE_WAITLIST_STATUSES } from "./waitlistConstants";

export class DuplicateActiveWaitlistEntryError extends Error {}

// Finds an existing active (waiting/invited) entry for this exact
// Contact + Offer + Cohort combination, if any. `cohortId` must be passed
// as `null` (not `undefined`) for an offer-level check — undefined would
// match "don't filter by cohort" instead of "cohort is null" against a
// FakeRest-style equality filter.
export const findActiveWaitlistEntry = async (
  dataProvider: DataProvider,
  {
    contactId,
    offerId,
    cohortId,
  }: {
    contactId: Identifier;
    offerId: Identifier;
    cohortId: Identifier | null;
  },
): Promise<WaitlistEntry | null> => {
  const { data: entries } = await dataProvider.getList<WaitlistEntry>(
    "waitlist_entries",
    {
      filter: { contact_id: contactId, offer_id: offerId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const match = entries.find(
    (entry) =>
      ACTIVE_WAITLIST_STATUSES.has(entry.status) &&
      (entry.cohort_id ?? null) === cohortId,
  );
  return match ?? null;
};

export const assertNoDuplicateActiveWaitlistEntry = async (
  dataProvider: DataProvider,
  params: {
    contactId: Identifier;
    offerId: Identifier;
    cohortId: Identifier | null;
  },
): Promise<void> => {
  const existing = await findActiveWaitlistEntry(dataProvider, params);
  if (existing) {
    throw new DuplicateActiveWaitlistEntryError(
      `Contact ${params.contactId} already has an active waitlist entry (#${existing.id}) for offer ${params.offerId}${
        params.cohortId != null ? ` / cohort ${params.cohortId}` : ""
      }`,
    );
  }
};
