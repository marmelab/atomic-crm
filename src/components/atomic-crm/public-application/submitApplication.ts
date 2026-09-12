import type { DataProvider, Identifier } from "ra-core";

import type { Application, Cohort, Contact, Deal, Offer, Sale } from "../types";
import { validateOfferCohort } from "../deals/offerCohortValidation";
import { getDenverDateString } from "../dashboard/artOracle/selectDailyArtwork";
import { isContactDoNotEngage } from "../contacts/doNotEngageGuard";
import {
  ensureReviewApplicationTask,
  findPendingReviewApplicationTask,
} from "../applications/reviewApplicationTask";
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

// Flat, user-authored answers (strings in practice, typed as `unknown` on
// Application to match the JSONB column) — a per-key value comparison is
// enough; no nested structures to deep-compare. Key order doesn't matter
// (both sides are sorted before comparing), and neither side ever includes
// a timestamp or generated id, so this can't be tripped up by a volatile
// value making an otherwise-identical retry look "changed" (real-
// infrastructure idempotency-refinement pass, requirement: "do not let
// volatile/request-generated values cause an otherwise identical retry to
// look changed").
const answersEqual = (
  a: Record<string, unknown>,
  b: Record<string, string>,
): boolean => {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, i) => key === bKeys[i] && a[key] === b[key]);
};

// Rate-limiting/abuse-protection assessment (real-infrastructure
// verification pass): an adversarial payload-size test against the real
// deployed function found NO server-side bound on an answer's length at
// all — a 2MB string was accepted and stored verbatim. Genuine free-text
// answers are realistically a paragraph or two; this cap is generous for
// that while closing the storage/cost-abuse vector a scripted caller could
// otherwise exploit repeatedly. Client-side mirror:
// PublicApplicationForm.tsx's own textarea maxLength (defense in depth,
// not the enforcement boundary — this check is).
const MAX_ANSWER_LENGTH = 5000;

const isWithinAnswerLengthLimit = (answers: Record<string, string>): boolean =>
  Object.values(answers).every(
    (value) => typeof value === "string" && value.length <= MAX_ANSWER_LENGTH,
  );

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
  if (!isWithinAnswerLengthLimit(input.answers)) {
    return {
      status: "validation-error",
      message: "One of your answers is too long. Please shorten it.",
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

  // Read current state ONCE, before any write, so an exact-duplicate retry
  // (double-click, a browser/network retry, or a deliberate resubmission
  // whose content genuinely didn't change) can be recognized and answered
  // with ZERO writes — not even the Contact's own last_seen bump.
  // Everything below either short-circuits on this read-only snapshot or
  // mutates using it directly, rather than re-querying (real-
  // infrastructure idempotency-refinement pass).
  const existingContact = await findExistingContactByEmail(dataProvider, email);
  const isDne = existingContact
    ? await isContactDoNotEngage(dataProvider, existingContact.id)
    : false;
  // DNE never reuses (§5, unchanged): always creates a fresh Deal/
  // Application below, so it's never eligible for the exact-retry or
  // update-in-place paths — searching for an active Deal at all would
  // silently reactivate one, exactly what "never silently reactivate a
  // DNE contact" forbids.
  const existingActiveDeal =
    existingContact && !isDne
      ? await findActiveDeal(dataProvider, {
          contactId: existingContact.id,
          offerId: offer.id,
          cohortId: cohort?.id ?? null,
        })
      : null;
  const existingPendingApplication = existingActiveDeal
    ? await findPendingApplication(dataProvider, existingActiveDeal.id)
    : null;

  // Application Intake Atomicity + Idempotency slice: this fast path used
  // to trust "Application matches" alone as proof the whole prior
  // submission fully completed. It doesn't: if Task creation failed on
  // that prior attempt (the one gap this dev/FakeRest mirror can't close
  // with a real transaction the way the production RPC now does — see
  // supabase/schemas/02_functions.sql's submit_public_application()
  // header), an identical retry would return early here and NEVER create
  // the missing Task. Requiring the Task to already exist too makes this
  // still a true no-op ONLY when the whole prior submission genuinely
  // completed.
  const existingPendingTask =
    existingActiveDeal && existingContact
      ? await findPendingReviewApplicationTask(dataProvider, existingContact.id)
      : null;
  if (
    existingPendingApplication &&
    answersEqual(existingPendingApplication.raw_answers, input.answers) &&
    existingPendingTask
  ) {
    // True state-level no-op: same applicant, same active Deal, same
    // still-pending Application, byte-for-byte identical answers, and the
    // Review Task already exists. Nothing downstream (Contact, Deal/stage,
    // Task due date, history) is touched.
    return {
      status: "submitted",
      applicationId: existingPendingApplication.id,
      dneAutoResolved: false,
    };
  }

  const contact = existingContact
    ? await touchExistingContact(dataProvider, existingContact)
    : await createContact(dataProvider, { firstName, lastName, email, phone });

  const { deal, reused } = existingActiveDeal
    ? { deal: existingActiveDeal, reused: true }
    : await createDeal(dataProvider, { contact, offer, cohort, isDne });

  if (reused && !isDne) {
    // Reusing writes nothing to "deals", so the centralized afterCreate
    // sync (providers/fakerest/dataProvider.ts -> waitlistSync.ts) never
    // fires for this path — call it directly, mirroring
    // waitlist/waitlistActions.ts's convertToOpportunity exactly (§13).
    await syncWaitlistForActiveDeal(deal, dataProvider);
  }

  const application = existingPendingApplication
    ? // Present but didn't match the exact-retry check above: the
      // applicant materially changed their answers before anyone
      // reviewed the pending Application (idempotency-refinement pass,
      // requirement 2). Update in place — same Application row, same
      // Deal, same Contact, same Task — only the content Leif will
      // actually see when reviewing changes.
      await updatePendingApplication(
        dataProvider,
        existingPendingApplication,
        input.answers,
      )
    : await findOrCreateApplication(dataProvider, {
        deal,
        answers: input.answers,
        isDne,
      });

  // Review Application Task: never created for the DNE auto-resolve path
  // — there is nothing pending for Leif to decide, the outcome is already
  // durable (confirmed decision, Native Application Intake slice §5/§8).
  // ensureReviewApplicationTask itself is idempotent (skips creation if a
  // pending one already exists), so the existing Task's due date is never
  // reset by a resubmission that reuses it — including the update-in-place
  // path just above.
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
const findExistingContactByEmail = async (
  dataProvider: DataProvider,
  email: string,
): Promise<Contact | null> => {
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
  return (
    contacts.find((contact) =>
      (contact.email_jsonb ?? []).some(
        (entry) => entry.email && normalizeEmail(entry.email) === email,
      ),
    ) ?? null
  );
};

// Existing Contact data is never overwritten — only `last_seen` is
// touched, a metadata timestamp, not "meaningful" identity data. Skipped
// entirely by the exact-retry fast path above (§ idempotency refinement).
const touchExistingContact = async (
  dataProvider: DataProvider,
  existing: Contact,
): Promise<Contact> => {
  await dataProvider.update("contacts", {
    id: existing.id,
    data: { last_seen: new Date().toISOString() },
    previousData: existing,
  });
  return existing;
};

const createContact = async (
  dataProvider: DataProvider,
  params: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  },
): Promise<Contact> => {
  const { data: created } = await dataProvider.create<Contact>("contacts", {
    data: {
      first_name: params.firstName,
      last_name: params.lastName,
      email_jsonb: [{ email: params.email, type: "Other" }],
      phone_jsonb: params.phone
        ? [{ number: params.phone, type: "Other" }]
        : [],
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
// convertToOpportunity exactly (§7): an existing active Deal for the same
// Contact + Offer + Cohort is reused rather than a second one created.
const findActiveDeal = async (
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
): Promise<Deal | null> => {
  const { data: existingDeals } = await dataProvider.getList<Deal>("deals", {
    filter: {
      contact_id: contactId,
      offer_id: offerId,
      ...(cohortId != null ? { cohort_id: cohortId } : {}),
    },
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });
  return existingDeals.find(isActiveDeal) ?? null;
};

// Never mutates stage on creation beyond the initial value below (the one
// existing precedent for this exact decision — a Deal already further
// along than "Application Received" should not visually regress, and one
// already at "Interested" still correctly reflects that an application now
// also exists via the Application row itself). DNE contacts always land
// here (never reuse, §5): a fresh Deal already in the exited state,
// preserving the historical fact that they applied again without touching
// any other Deal.
const createDeal = async (
  dataProvider: DataProvider,
  {
    contact,
    offer,
    cohort,
    isDne,
  }: { contact: Contact; offer: Offer; cohort: Cohort | null; isDne: boolean },
): Promise<{ deal: Deal; reused: boolean }> => {
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

// The most recent Application for a Deal, but ONLY if it's still pending
// review — an already-reviewed Application (approved / needs_higher_care /
// not_fit / do_not_engage) is never eligible for the exact-retry or
// update-in-place paths (§ idempotency refinement, requirements 1-2 are
// both explicitly scoped to "while the existing Application is still
// pending"): once Leif has acted, a later resubmission must not silently
// rewrite what he already reviewed.
const findPendingApplication = async (
  dataProvider: DataProvider,
  dealId: Identifier,
): Promise<Application | null> => {
  const { data: existing } = await dataProvider.getList<Application>(
    "applications",
    {
      filter: { opportunity_id: dealId },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "DESC" },
    },
  );
  const mostRecent = existing[0];
  return mostRecent && mostRecent.status === "pending" ? mostRecent : null;
};

// Applies a materially-changed resubmission to the still-pending
// Application already found by findPendingApplication — same row, same id,
// only raw_answers/submitted_at move.
const updatePendingApplication = async (
  dataProvider: DataProvider,
  existing: Application,
  answers: Record<string, string>,
): Promise<Application> => {
  const { data: updated } = await dataProvider.update<Application>(
    "applications",
    {
      id: existing.id,
      data: {
        raw_answers: answers,
        submitted_at: new Date().toISOString(),
      },
      previousData: existing,
    },
  );
  return updated;
};

// Idempotent: reached only when there's no still-pending Application to
// update in place — either none exists yet for this Deal, or the most
// recent one has already been reviewed (returned as-is, never rewritten;
// see findPendingApplication above). A DNE application is recorded already
// reviewed (status set directly, reviewed_at = submitted_at) since the
// outcome is already durable — mirrors reviewApplication.ts's own
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
