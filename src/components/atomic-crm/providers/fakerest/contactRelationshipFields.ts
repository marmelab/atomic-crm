import type { DataProvider, Identifier, RaRecord } from "ra-core";

import type { Application, Deal, Enrollment, WaitlistEntry } from "../../types";
import { ACTIVE_WAITLIST_STATUSES } from "../../waitlist/waitlistConstants";

const ACTIVE_ENROLLMENT_STATUSES = new Set(["onboarding", "active"]);
const PAST_ENROLLMENT_STATUSES = new Set(["offboarding", "completed"]);

export type ContactRelationshipFields = {
  offer_ids: Identifier[];
  is_current_client: boolean;
  is_past_client: boolean;
  has_applied: boolean;
  is_on_waitlist: boolean;
  has_nurture_deal: boolean;
};

// FakeRest's own dev/demo mirror of contacts_summary's computed relationship
// columns (Contacts UX cleanup pass — see supabase/schemas/03_views.sql's
// own header comment for the real-Postgres half of this dual
// implementation). Recomputed fresh from the CURRENT live data on every
// "contacts" getList call, never incrementally maintained — deliberately
// simpler than nb_tasks's own incremental-hook approach (which would mean
// wiring update hooks across FOUR other resources here); recompute-on-read
// is trivially correct and this app's dev-scale data makes the extra reads
// a non-issue.
//
// Uses `baseDataProvider` (unwrapped by withLifecycleCallbacks) — never
// the outer hook-wrapped `dataProvider` — so writing these fields back
// never triggers the "contacts" resource's own beforeUpdate hooks
// (avatar processing, company data refetch), which have nothing to do
// with this and would be wasted work on every single page load.
export const computeContactRelationshipFields = (params: {
  contactId: Identifier;
  deals: Deal[];
  enrollments: Enrollment[];
  applications: Application[];
  waitlistEntries: WaitlistEntry[];
}): ContactRelationshipFields => {
  const { contactId, deals, enrollments, applications, waitlistEntries } =
    params;
  const contactDeals = deals.filter((d) => d.contact_id === contactId);
  const dealIds = new Set(contactDeals.map((d) => d.id));
  const contactEnrollments = enrollments.filter((e) =>
    dealIds.has(e.opportunity_id),
  );
  const contactApplications = applications.filter((a) =>
    dealIds.has(a.opportunity_id),
  );
  const contactWaitlistEntries = waitlistEntries.filter(
    (w) => w.contact_id === contactId,
  );

  return {
    offer_ids: [...new Set(contactDeals.map((d) => d.offer_id))],
    is_current_client: contactEnrollments.some((e) =>
      ACTIVE_ENROLLMENT_STATUSES.has(e.status),
    ),
    is_past_client: contactEnrollments.some((e) =>
      PAST_ENROLLMENT_STATUSES.has(e.status),
    ),
    has_applied: contactApplications.length > 0,
    is_on_waitlist: contactWaitlistEntries.some((w) =>
      ACTIVE_WAITLIST_STATUSES.has(w.status),
    ),
    has_nurture_deal: contactDeals.some(
      (d) => d.outcome === "nurture" && d.archived_at == null,
    ),
  };
};

const fieldsChanged = (
  a: ContactRelationshipFields,
  b: Partial<ContactRelationshipFields>,
): boolean =>
  a.is_current_client !== b.is_current_client ||
  a.is_past_client !== b.is_past_client ||
  a.has_applied !== b.has_applied ||
  a.is_on_waitlist !== b.is_on_waitlist ||
  a.has_nurture_deal !== b.has_nurture_deal ||
  JSON.stringify([...a.offer_ids].sort()) !==
    JSON.stringify([...(b.offer_ids ?? [])].sort());

// Some existing tests construct a minimal FakeRest `db` that never
// registers every collection this needs (e.g. a Contacts-only fixture
// with no "enrollments"/"applications" at all) — `Database` throws
// "Undefined collection" for a resource it was never given, which would
// otherwise break every "contacts" read in those tests for a feature
// they aren't exercising. Treat a genuinely absent collection as "no rows
// for this relationship" rather than a fatal error.
const getListOrEmpty = async <T extends RaRecord>(
  baseDataProvider: DataProvider,
  resource: string,
): Promise<T[]> => {
  try {
    const { data } = await baseDataProvider.getList<T>(resource, {
      filter: {},
      pagination: { page: 1, perPage: 10_000 },
      sort: { field: "id", order: "ASC" },
    });
    return data;
  } catch {
    return [];
  }
};

export const syncContactRelationshipFields = async (
  baseDataProvider: DataProvider,
): Promise<void> => {
  const [contacts, deals, enrollments, applications, waitlistEntries] =
    await Promise.all([
      getListOrEmpty<{ id: Identifier } & Partial<ContactRelationshipFields>>(
        baseDataProvider,
        "contacts",
      ),
      getListOrEmpty<Deal>(baseDataProvider, "deals"),
      getListOrEmpty<Enrollment>(baseDataProvider, "enrollments"),
      getListOrEmpty<Application>(baseDataProvider, "applications"),
      getListOrEmpty<WaitlistEntry>(baseDataProvider, "waitlist_entries"),
    ]);

  await Promise.all(
    contacts.map(async (contact) => {
      const fields = computeContactRelationshipFields({
        contactId: contact.id,
        deals,
        enrollments,
        applications,
        waitlistEntries,
      });
      if (!fieldsChanged(fields, contact)) return;
      await baseDataProvider.update("contacts", {
        id: contact.id,
        data: fields,
        previousData: contact,
      });
    }),
  );
};
