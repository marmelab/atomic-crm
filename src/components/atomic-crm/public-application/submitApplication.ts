import type { DataProvider, Identifier } from "ra-core";

import type { Application, Cohort, Contact, Deal, Offer, Sale } from "../types";
import { validateOfferCohort } from "../deals/offerCohortValidation";
import { getDenverDateString } from "../dashboard/artOracle/selectDailyArtwork";
import { isContactDoNotEngage } from "../contacts/doNotEngageGuard";
import { ensureReviewApplicationTask } from "../applications/reviewApplicationTask";
import { syncWaitlistForActiveDeal } from "../waitlist/waitlistSync";

// Native Application Intake slice (§1-§14): the dev/FakeRest-backed half of
// the dual-implementation intake path. Mirrors reviewApplication.ts's own
// idempotent-via-refetch convention — every check re-reads current server
// state rather than trusting the caller. The production path is
// supabase/functions/public_application/index.ts, which applies the exact
// same rules server-side (via supabaseAdmin, bypassing RLS — see that
// file's own header) since Postgres RLS is `to authenticated` only on
// every table (§15): a public/anon caller cannot read or write Contacts,
// Deals, Applications, Offers, or Cohorts directly, so a client-side
// dataProvider call can never be the production write path. This module
// stays the FakeRest-testable "logic of record" that the Edge Function
// mirrors — the same dual-implementation pattern already used for
// waitlist sync (deal_waitlist_sync trigger <-> waitlistSync.ts) and deal
// save validation (handle_deal_saved() <-> offerCohortValidation.ts).

export type PublicApplicationInput = {
  offerId: Identifier;
  cohortId?: Identifier | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  answers: Record<string, string>;
};

export type SubmitApplicationResult =
  | {
      status: "submitted";
      applicationId: Identifier;
      // Never read by the public UI (the applicant sees identical copy
      // either way, per the confirmed DNE decision) — only for tests/
      // internal verification that the silent-resolve path actually ran.
      dneAutoResolved: boolean;
    }
  | { status: "offer-invalid" }
  | { status: "cohort-invalid" }
  | { status: "cohort-closed" }
  | { status: "validation-error"; message: string };

export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

// Deliberately loose (one @, something on each side) — real confirmation
// that the address works happens by the applicant actually receiving
// correspondence later, not by a strict client-side regex.
const isPlausibleEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Same active-pipeline definition waitlist/waitlistActions.ts's own
// isActiveDeal already uses (not won, not archived, no exit outcome) —
// duplicated rather than imported since that one is a private, unexported
// helper local to the waitlist module; both are one-line predicates over
// the same three Deal fields, low risk of silently diverging.
const isActiveDeal = (deal: Pick<Deal, "stage" | "outcome" | "archived_at">) =>
  deal.archived_at == null && deal.stage !== "won" && deal.outcome == null;

const isCohortAcceptingApplications = (
  cohort: Pick<
    Cohort,
    "status" | "applications_open_at" | "applications_close_at"
  >,
  today: string,
): boolean => {
  if (cohort.status !== "applications_open") return false;
  if (cohort.applications_open_at && today < cohort.applications_open_at) {
    return false;
  }
  if (cohort.applications_close_at && today > cohort.applications_close_at) {
    return false;
  }
  return true;
};

export const submitApplication = async (
  dataProvider: DataProvider,
  input: PublicApplicationInput,
): Promise<SubmitApplicationResult> => {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = normalizeEmail(input.email);
  const phone = input.phone?.trim() || null;

  if (!firstName || !lastName) {
    return { status: "validation-error", message: "Name is required." };
  }
  if (!email || !isPlausibleEmail(email)) {
    return {
      status: "validation-error",
      message: "A valid email is required.",
    };
  }

  const offer = await dataProvider
    .getOne<Offer>("offers", { id: input.offerId })
    .then(({ data }) => data)
    .catch(() => null);
  if (!offer || !offer.is_active) {
    return { status: "offer-invalid" };
  }

  let cohort: Cohort | null = null;
  if (offer.type === "group") {
    if (input.cohortId == null) {
      return { status: "cohort-invalid" };
    }
    cohort = await dataProvider
      .getOne<Cohort>("cohorts", { id: input.cohortId })
      .then(({ data }) => data)
      .catch(() => null);
    if (!cohort) {
      return { status: "cohort-invalid" };
    }
    try {
      validateOfferCohort(offer, cohort);
    } catch {
      return { status: "cohort-invalid" };
    }
    const today = getDenverDateString();
    if (!isCohortAcceptingApplications(cohort, today)) {
      return { status: "cohort-closed" };
    }
  }

  const contact = await findOrCreateContact(dataProvider, {
    firstName,
    lastName,
    email,
    phone,
  });

  const isDne = await isContactDoNotEngage(dataProvider, contact.id);

  const { deal, reused } = await findOrCreateDeal(dataProvider, {
    contact,
    offer,
    cohort,
    isDne,
  });

  if (reused && !isDne) {
    // Reusing writes nothing to "deals", so the centralized afterCreate
    // sync (providers/fakerest/dataProvider.ts -> waitlistSync.ts) never
    // fires for this path — call it directly, mirroring
    // waitlist/waitlistActions.ts's convertToOpportunity exactly (§13).
    await syncWaitlistForActiveDeal(deal, dataProvider);
  }

  const application = await findOrCreateApplication(dataProvider, {
    deal,
    answers: input.answers,
    isDne,
  });

  // Review Application Task: never created for the DNE auto-resolve path
  // — there is nothing pending for Leif to decide, the outcome is already
  // durable (confirmed decision, Native Application Intake slice §5/§8).
  if (!isDne) {
    await ensureReviewApplicationTask(dataProvider, {
      contactId: contact.id,
      applicantName: `${contact.first_name} ${contact.last_name}`.trim(),
      salesId: await resolveDefaultTaskSalesId(dataProvider),
    });
  }

  return {
    status: "submitted",
    applicationId: application.id,
    dneAutoResolved: isDne,
  };
};

// Normalized-email match (case/whitespace-insensitive), reused as the
// primary durable matching key (§5). No name-only fallback: a same-name
// different-email applicant is a distinct Contact until proven otherwise.
// Existing Contact data is never overwritten — only `last_seen` is
// touched, a metadata timestamp, not "meaningful" identity data.
const findOrCreateContact = async (
  dataProvider: DataProvider,
  {
    firstName,
    lastName,
    email,
    phone,
  }: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  },
): Promise<Contact> => {
  // Full-table scan: correct at this app's actual scale (§12 allows a
  // documented dev-only limitation; a real production hardening pass
  // would add a normalized/indexed email column instead). The Edge
  // Function's production path has this same documented limitation — see
  // its header comment.
  const { data: contacts } = await dataProvider.getList<Contact>("contacts", {
    filter: {},
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "id", order: "ASC" },
  });
  const existing = contacts.find((contact) =>
    (contact.email_jsonb ?? []).some(
      (entry) => entry.email && normalizeEmail(entry.email) === email,
    ),
  );
  if (existing) {
    await dataProvider.update("contacts", {
      id: existing.id,
      data: { last_seen: new Date().toISOString() },
      previousData: existing,
    });
    return existing;
  }

  const { data: created } = await dataProvider.create<Contact>("contacts", {
    data: {
      first_name: firstName,
      last_name: lastName,
      email_jsonb: [{ email, type: "Other" }],
      phone_jsonb: phone ? [{ number: phone, type: "Other" }] : [],
      tags: [],
      has_newsletter: false,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      sales_eligibility: "normal",
    },
  });
  return created;
};

// Duplicate-Opportunity avoidance mirrors waitlist/waitlistActions.ts's
// convertToOpportunity exactly (§7): reuse an existing active Deal for the
// same Contact + Offer + Cohort rather than creating a second one, and
// never mutate its stage on reuse (the one existing precedent for this
// exact decision — a Deal already further along than "Application
// Received" should not visually regress, and one already at "Interested"
// still correctly reflects that an application now also exists via the
// Application row itself).
//
// DNE contacts skip the reuse search entirely (§5): reusing an existing
// active Deal would silently reactivate it, exactly what "never silently
// reactivate a DNE contact" forbids. A DNE applicant instead always gets a
// fresh Deal created already in the exited state below, preserving the
// historical fact that they applied again without touching any other Deal.
const findOrCreateDeal = async (
  dataProvider: DataProvider,
  {
    contact,
    offer,
    cohort,
    isDne,
  }: { contact: Contact; offer: Offer; cohort: Cohort | null; isDne: boolean },
): Promise<{ deal: Deal; reused: boolean }> => {
  if (!isDne) {
    const { data: existingDeals } = await dataProvider.getList<Deal>("deals", {
      filter: {
        contact_id: contact.id,
        offer_id: offer.id,
        ...(cohort != null ? { cohort_id: cohort.id } : {}),
      },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    });
    const existingActive = existingDeals.find(isActiveDeal);
    if (existingActive) {
      return { deal: existingActive, reused: true };
    }
  }

  const { data: created } = await dataProvider.create<Deal>("deals", {
    data: {
      contact_id: contact.id,
      offer_id: offer.id,
      cohort_id: cohort?.id ?? null,
      stage: "application_received",
      outcome: isDne ? "lost" : null,
      owner_decision: isDne ? "do_not_engage" : null,
      amount: offer.current_price,
      entry_path: "application_form",
      description: "",
    },
  });
  return { deal: created, reused: false };
};

// Acceptance-repair pass: dashboard/DashboardTasks.tsx filters its "Overdue
// / Today / Next 7 Days" query by `sales_id: identity?.id` (the logged-in
// user's own tasks). A Task created with no `sales_id` at all — which is
// what every public submission produced before this fix, since there is no
// logged-in identity during an anonymous intake request — silently never
// matches that filter and so never appears on the Dashboard, even though
// the task genuinely exists (visible on the Contact page's own task list,
// which has no such filter). This app has exactly one real owner: the
// `sales` row with `administrator: true` (this app's own single-operator
// convention — see sales/SalesList.tsx's own "Admin" badge, and every
// FakeRest fixture seeds exactly one). Resolving and assigning it at
// intake, only for the Task, is the minimal fix: Contact/Deal creation
// intentionally still don't set sales_id (mirrors
// waitlist/waitlistActions.ts's convertToOpportunity, and neither the
// Applications list nor the Contacts list filters by owner the way the
// Dashboard's task view does — both already worked before this repair).
const resolveDefaultTaskSalesId = async (
  dataProvider: DataProvider,
): Promise<Identifier | undefined> => {
  const { data: administrators } = await dataProvider.getList<Sale>("sales", {
    filter: { administrator: true },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  return administrators[0]?.id;
};

// Idempotent: a double-click, a refresh after submit, or a repeat POST for
// the same resolved Deal reuses the most recent existing Application
// rather than creating a second one (§12). A DNE application is recorded
// already reviewed (status set directly, reviewed_at = submitted_at) since
// the outcome is already durable — mirrors reviewApplication.ts's own
// do_not_engage branch shape.
const findOrCreateApplication = async (
  dataProvider: DataProvider,
  {
    deal,
    answers,
    isDne,
  }: { deal: Deal; answers: Record<string, string>; isDne: boolean },
): Promise<Application> => {
  const { data: existing } = await dataProvider.getList<Application>(
    "applications",
    {
      filter: { opportunity_id: deal.id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "DESC" },
    },
  );
  if (existing.length > 0) {
    return existing[0]!;
  }

  const submittedAt = new Date().toISOString();
  const { data: created } = await dataProvider.create<Application>(
    "applications",
    {
      data: {
        opportunity_id: deal.id,
        raw_answers: answers,
        submitted_at: submittedAt,
        status: isDne ? "do_not_engage" : "pending",
        reviewed_at: isDne ? submittedAt : null,
      },
    },
  );
  return created;
};
