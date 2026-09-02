// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Native Application Intake slice (§15): the production write (and read)
// path for the public /apply routes. Deliberately NOT gated by
// AuthMiddleware/UserMiddleware (contrast merge_contacts/index.ts,
// users/index.ts) — an applicant has no CRM account. Every table's RLS is
// `to authenticated` only (see supabase/schemas/05_policies.sql), so this
// function uses supabaseAdmin (service-role, bypasses RLS) to do on the
// applicant's behalf exactly what a logged-in caller's own dataProvider
// calls would otherwise do — mirroring the postmark/ function's own
// "externally-triggered, validated, privileged write" shape, just with
// browser/CORS-facing validation instead of an IP allowlist + webhook auth
// header (postmark/index.ts's checkRequestTypeAndHeaders), since a public
// form is reached from arbitrary browsers, not one known webhook sender.
//
// Business rules here MIRROR (do not share code with — Deno/Edge Functions
// don't import from src/, see every other function in this directory)
// src/components/atomic-crm/public-application/submitApplication.ts and
// publicOfferContext.ts, the FakeRest/dev-testable "logic of record" for
// this same slice. Keep the two in sync by hand if either changes — the
// same dual-implementation convention already used for
// deal_waitlist_sync/waitlistSync.ts and handle_deal_saved()/
// offerCohortValidation.ts.
//
// Verified against the real linked dev project (Native Application Intake
// real-infrastructure verification pass): deployed, exercised through the
// actual public /apply/living-example browser form, and confirmed end to
// end (Contact/Deal/Application/Task/history) via direct database
// inspection — including retry/duplicate-submission and update-in-place-
// while-pending behavior. To smoke-test locally instead:
// `make start-supabase-functions`, then:
//
//   curl -i --location --request POST \
//     'http://127.0.0.1:54321/functions/v1/public_application' \
//     --header 'Content-Type: application/json' \
//     --data '{"action":"context","offer":"living-example"}'
//
//   curl -i --location --request POST \
//     'http://127.0.0.1:54321/functions/v1/public_application' \
//     --header 'Content-Type: application/json' \
//     --data '{"action":"submit","offerId":1,"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","answers":{"why_this_program":"..."}}'

type OfferRow = {
  id: number;
  name: string;
  type: "individual" | "group";
  current_price: number;
  max_active_clients: number | null;
  is_active: boolean;
};

type CohortRow = {
  id: number;
  offer_id: number;
  name: string;
  status: string;
  applications_open_at: string | null;
  applications_close_at: string | null;
};

type ContactRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email_jsonb: { email: string; type: string }[] | null;
  sales_eligibility: string;
};

type DealRow = {
  id: number;
  contact_id: number;
  offer_id: number;
  cohort_id: number | null;
  stage: string;
  outcome: string | null;
  archived_at: string | null;
};

type ApplicationRow = {
  id: number;
  status: string;
  raw_answers: Record<string, unknown>;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const isPlausibleEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const getDenverDateString = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const isActiveDeal = (
  deal: Pick<DealRow, "stage" | "outcome" | "archived_at">,
) => deal.archived_at == null && deal.stage !== "won" && deal.outcome == null;

const isCohortAcceptingApplications = (
  cohort: Pick<
    CohortRow,
    "status" | "applications_open_at" | "applications_close_at"
  >,
  today: string,
): boolean => {
  if (cohort.status !== "applications_open") return false;
  if (cohort.applications_open_at && today < cohort.applications_open_at)
    return false;
  if (cohort.applications_close_at && today > cohort.applications_close_at)
    return false;
  return true;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

// Flat, user-authored answers — a per-key value comparison is enough; no
// nested structures to deep-compare. Key order doesn't matter (both sides
// are sorted before comparing), and neither side ever includes a timestamp
// or generated id, so this can't be tripped up by a volatile value making
// an otherwise-identical retry look "changed" (real-infrastructure
// idempotency-refinement pass — mirrors
// submitApplication.ts's own answersEqual exactly).
const answersEqual = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean => {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, i) => key === bKeys[i] && a[key] === b[key]);
};

// Rate-limiting/abuse-protection assessment (real-infrastructure
// verification pass): an adversarial payload-size test against this real
// deployed function found NO server-side bound on an answer's length at
// all — a 2MB string was accepted and stored verbatim. Genuine free-text
// answers are realistically a paragraph or two; this cap is generous for
// that while closing the storage/cost-abuse vector a scripted caller could
// otherwise exploit repeatedly. Mirrors submitApplication.ts's own
// MAX_ANSWER_LENGTH exactly. Client-side mirror:
// PublicApplicationForm.tsx's own textarea maxLength (defense in depth,
// not the enforcement boundary — this check is).
const MAX_ANSWER_LENGTH = 5000;

const isWithinAnswerLengthLimit = (answers: Record<string, unknown>): boolean =>
  Object.values(answers).every(
    (value) => typeof value === "string" && value.length <= MAX_ANSWER_LENGTH,
  );

const handleContext = async (body: Record<string, unknown>) => {
  if (body.offer === "living-example") {
    const { data: offers } = await supabaseAdmin
      .from("offers")
      .select("id, name, type, current_price, max_active_clients, is_active")
      .eq("type", "individual");
    const offer = ((offers ?? []) as OfferRow[]).find(
      (candidate) =>
        candidate.max_active_clients != null && candidate.is_active,
    );
    if (!offer) return jsonResponse({ kind: "not-found" });
    return jsonResponse({
      kind: "individual",
      offerId: offer.id,
      offerName: offer.name,
      isAccepting: true,
    });
  }

  if (body.offer === "growing-yourself-up") {
    const cohortId = body.cohortId;
    if (cohortId == null) return jsonResponse({ kind: "not-found" });
    const { data: cohort } = await supabaseAdmin
      .from("cohorts")
      .select(
        "id, offer_id, name, status, applications_open_at, applications_close_at",
      )
      .eq("id", cohortId)
      .maybeSingle();
    if (!cohort) return jsonResponse({ kind: "not-found" });

    const { data: offer } = await supabaseAdmin
      .from("offers")
      .select("id, name, type, current_price, max_active_clients, is_active")
      .eq("id", (cohort as CohortRow).offer_id)
      .maybeSingle();
    if (
      !offer ||
      !(offer as OfferRow).is_active ||
      (offer as OfferRow).type !== "group"
    ) {
      return jsonResponse({ kind: "not-found" });
    }

    const today = getDenverDateString();
    if (!isCohortAcceptingApplications(cohort as CohortRow, today)) {
      return jsonResponse({
        kind: "group-closed",
        offerName: (offer as OfferRow).name,
        cohortName: (cohort as CohortRow).name,
      });
    }
    return jsonResponse({
      kind: "group-open",
      offerId: (offer as OfferRow).id,
      offerName: (offer as OfferRow).name,
      cohortId: (cohort as CohortRow).id,
      cohortName: (cohort as CohortRow).name,
      isAccepting: true,
    });
  }

  return jsonResponse({ kind: "not-found" });
};

// Normalized-email match (case/whitespace-insensitive), the primary
// durable matching key (§5). Read-only — never mutates.
const findExistingContactByEmail = async (
  email: string,
): Promise<ContactRow | null> => {
  // Full-table scan, matching the dev domain function's own documented
  // limitation (submitApplication.ts's own equivalent) — correct at this
  // app's actual scale; a production hardening pass would add a
  // normalized/indexed email column instead.
  const { data: contacts } = await supabaseAdmin
    .from("contacts")
    .select("id, first_name, last_name, email_jsonb, sales_eligibility");
  const existing = ((contacts ?? []) as ContactRow[]).find((contact) =>
    (contact.email_jsonb ?? []).some(
      (entry) => entry.email && normalizeEmail(entry.email) === email,
    ),
  );
  return existing ?? null;
};

// Existing Contact data is never overwritten — only `last_seen` is
// touched, a metadata timestamp, not "meaningful" identity data. Skipped
// entirely by the exact-retry fast path in handleSubmit (real-
// infrastructure idempotency-refinement pass).
const touchExistingContact = async (
  existing: ContactRow,
): Promise<ContactRow> => {
  await supabaseAdmin
    .from("contacts")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", existing.id);
  return existing;
};

const createContact = async (params: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}): Promise<ContactRow> => {
  const { data: created, error } = await supabaseAdmin
    .from("contacts")
    .insert({
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
    })
    .select("id, first_name, last_name, email_jsonb, sales_eligibility")
    .single();
  if (error || !created)
    throw new Error(error?.message ?? "Failed to create contact");
  return created as ContactRow;
};

// Duplicate-Opportunity avoidance (§7): an existing active Deal for the
// same Contact + Offer + Cohort is reused rather than a second one
// created. Read-only — never mutates. DNE contacts never reach here (§5,
// see handleSubmit): searching for an active Deal at all would risk
// silently reactivating one.
const findActiveDeal = async (params: {
  contactId: number;
  offerId: number;
  cohortId: number | null;
}): Promise<DealRow | null> => {
  let query = supabaseAdmin
    .from("deals")
    .select("id, contact_id, offer_id, cohort_id, stage, outcome, archived_at")
    .eq("contact_id", params.contactId)
    .eq("offer_id", params.offerId);
  query =
    params.cohortId != null ? query.eq("cohort_id", params.cohortId) : query;
  const { data: existingDeals } = await query;
  const existingActive = ((existingDeals ?? []) as DealRow[]).find(
    isActiveDeal,
  );
  return existingActive ?? null;
};

// Never mutates stage beyond the initial value below (a Deal already
// further along than "Application Received" should not visually regress).
// DNE contacts always land here (never reuse, §5): a fresh Deal already in
// the exited state, preserving the historical fact that they applied again
// without touching any other Deal.
const createDeal = async (params: {
  contact: ContactRow;
  offer: OfferRow;
  cohort: CohortRow | null;
  isDne: boolean;
}): Promise<{ deal: DealRow; reused: boolean }> => {
  const { data: created, error } = await supabaseAdmin
    .from("deals")
    .insert({
      contact_id: params.contact.id,
      offer_id: params.offer.id,
      cohort_id: params.cohort?.id ?? null,
      stage: "application_received",
      outcome: params.isDne ? "lost" : null,
      owner_decision: params.isDne ? "do_not_engage" : null,
      amount: params.offer.current_price,
      entry_path: "application_form",
      description: "",
    })
    .select("id, contact_id, offer_id, cohort_id, stage, outcome, archived_at")
    .single();
  if (error || !created)
    throw new Error(error?.message ?? "Failed to create deal");
  return { deal: created as DealRow, reused: false };
};

// Mirrors handle_deal_waitlist_sync() (supabase/schemas/02_functions.sql)
// exactly — same WHERE clause, same fields — for the one path that never
// fires that trigger on its own (see the call site's own comment).
const syncWaitlistForActiveDeal = async (deal: DealRow): Promise<void> => {
  if (deal.archived_at != null || deal.outcome != null) return;
  await supabaseAdmin
    .from("waitlist_entries")
    .update({
      status: "converted",
      converted_at: new Date().toISOString(),
      converted_opportunity_id: deal.id,
    })
    .eq("contact_id", deal.contact_id)
    .eq("offer_id", deal.offer_id)
    .in("status", ["waiting", "invited"])
    .or(
      deal.cohort_id != null
        ? `cohort_id.is.null,cohort_id.eq.${deal.cohort_id}`
        : "cohort_id.is.null",
    );
};

// The most recent Application for a Deal, but ONLY if it's still pending
// review — an already-reviewed Application (approved / needs_higher_care /
// not_fit / do_not_engage) is never eligible for the exact-retry or
// update-in-place paths (real-infrastructure idempotency-refinement pass:
// both are explicitly scoped to "while the existing Application is still
// pending" — once Leif has acted, a later resubmission must not silently
// rewrite what he already reviewed). Read-only — never mutates.
const findPendingApplication = async (
  dealId: number,
): Promise<ApplicationRow | null> => {
  const { data: existing } = await supabaseAdmin
    .from("applications")
    .select("id, status, raw_answers")
    .eq("opportunity_id", dealId)
    .order("id", { ascending: false })
    .limit(1);
  const mostRecent = (existing?.[0] as ApplicationRow | undefined) ?? null;
  return mostRecent && mostRecent.status === "pending" ? mostRecent : null;
};

// Applies a materially-changed resubmission to the still-pending
// Application already found by findPendingApplication — same row, same
// id, only raw_answers/submitted_at move.
const updatePendingApplication = async (
  existing: ApplicationRow,
  answers: Record<string, string>,
): Promise<{ id: number }> => {
  const { data: updated, error } = await supabaseAdmin
    .from("applications")
    .update({
      raw_answers: answers,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select("id")
    .single();
  if (error || !updated)
    throw new Error(error?.message ?? "Failed to update application");
  return updated as { id: number };
};

// Idempotent: reached only when there's no still-pending Application to
// update in place — either none exists yet for this Deal, or the most
// recent one has already been reviewed (returned as-is, never rewritten;
// see findPendingApplication above). A DNE application is recorded already
// reviewed (status set directly, reviewed_at = submitted_at) since the
// outcome is already durable.
const findOrCreateApplication = async (params: {
  dealId: number;
  answers: Record<string, string>;
  isDne: boolean;
}): Promise<{ id: number }> => {
  const { data: existing } = await supabaseAdmin
    .from("applications")
    .select("id")
    .eq("opportunity_id", params.dealId)
    .order("id", { ascending: false })
    .limit(1);
  if (existing && existing.length > 0) return existing[0] as { id: number };

  const submittedAt = new Date().toISOString();
  const { data: created, error } = await supabaseAdmin
    .from("applications")
    .insert({
      opportunity_id: params.dealId,
      raw_answers: params.answers,
      submitted_at: submittedAt,
      status: params.isDne ? "do_not_engage" : "pending",
      reviewed_at: params.isDne ? submittedAt : null,
    })
    .select("id")
    .single();
  if (error || !created)
    throw new Error(error?.message ?? "Failed to create application");
  return created as { id: number };
};

const REVIEW_APPLICATION_TASK_TYPE = "review_application";

// Acceptance-repair pass: the Dashboard's own task view (DashboardTasks.tsx)
// filters by `sales_id: identity?.id` (the logged-in user's own tasks). A
// Task created with no sales_id at all — every one this function produced
// before this fix, since there is no logged-in identity during a public
// submission — never matches that filter and so never surfaces there, even
// though it genuinely exists (see submitApplication.ts's own
// resolveDefaultTaskSalesId, which this mirrors: this app has exactly one
// real owner, the `sales` row with administrator = true).
const resolveDefaultTaskSalesId = async (): Promise<number | undefined> => {
  const { data: administrators } = await supabaseAdmin
    .from("sales")
    .select("id")
    .eq("administrator", true)
    .limit(1);
  return administrators?.[0]?.id;
};

const ensureReviewApplicationTask = async (
  contactId: number,
  applicantName: string,
) => {
  const { data: existingTasks } = await supabaseAdmin
    .from("tasks")
    .select("id, done_date")
    .eq("contact_id", contactId)
    .eq("type", REVIEW_APPLICATION_TASK_TYPE);
  const hasPending = (existingTasks ?? []).some((task) => !task.done_date);
  if (hasPending) return;

  const salesId = await resolveDefaultTaskSalesId();
  await supabaseAdmin.from("tasks").insert({
    contact_id: contactId,
    type: REVIEW_APPLICATION_TASK_TYPE,
    text: `Review ${applicantName}'s application`,
    due_date: new Date().toISOString(),
    status: "pending",
    ...(salesId != null ? { sales_id: salesId } : {}),
  });
};

const handleSubmit = async (body: Record<string, unknown>) => {
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = normalizeEmail(String(body.email ?? ""));
  const phone = body.phone ? String(body.phone).trim() : null;
  const answers = (body.answers ?? {}) as Record<string, string>;
  // Honeypot: a real applicant never fills a field this named/hidden; a
  // basic bot fills every field it finds. A non-empty value here means
  // "silently pretend this worked" rather than telling an automated
  // caller what tripped detection (never signals anything to the
  // applicant either way — mirrors the DNE auto-resolve decision's own
  // "no differentiated copy" principle).
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return jsonResponse({
      status: "submitted",
      applicationId: 0,
      dneAutoResolved: false,
    });
  }

  if (!firstName || !lastName) {
    return jsonResponse({
      status: "validation-error",
      message: "Name is required.",
    });
  }
  if (!email || !isPlausibleEmail(email)) {
    return jsonResponse({
      status: "validation-error",
      message: "A valid email is required.",
    });
  }
  if (!isWithinAnswerLengthLimit(answers)) {
    return jsonResponse({
      status: "validation-error",
      message: "One of your answers is too long. Please shorten it.",
    });
  }

  const { data: offer } = await supabaseAdmin
    .from("offers")
    .select("id, name, type, current_price, max_active_clients, is_active")
    .eq("id", body.offerId as number)
    .maybeSingle();
  if (!offer || !(offer as OfferRow).is_active) {
    return jsonResponse({ status: "offer-invalid" });
  }
  const offerRow = offer as OfferRow;

  let cohort: CohortRow | null = null;
  if (offerRow.type === "group") {
    if (body.cohortId == null)
      return jsonResponse({ status: "cohort-invalid" });
    const { data: cohortData } = await supabaseAdmin
      .from("cohorts")
      .select(
        "id, offer_id, name, status, applications_open_at, applications_close_at",
      )
      .eq("id", body.cohortId as number)
      .maybeSingle();
    if (!cohortData) return jsonResponse({ status: "cohort-invalid" });
    cohort = cohortData as CohortRow;
    if (cohort.offer_id !== offerRow.id) {
      return jsonResponse({ status: "cohort-invalid" });
    }
    const today = getDenverDateString();
    if (!isCohortAcceptingApplications(cohort, today)) {
      return jsonResponse({ status: "cohort-closed" });
    }
  }

  // Read current state ONCE, before any write, so an exact-duplicate retry
  // (double-click, a browser/network retry, or a deliberate resubmission
  // whose content genuinely didn't change) can be recognized and answered
  // with ZERO writes — not even the Contact's own last_seen bump.
  // Everything below either short-circuits on this read-only snapshot or
  // mutates using it directly, rather than re-querying (real-
  // infrastructure idempotency-refinement pass — mirrors
  // submitApplication.ts's own submitApplication exactly).
  const existingContact = await findExistingContactByEmail(email);
  const isDne = existingContact?.sales_eligibility === "do_not_engage";
  // DNE never reuses (§5, unchanged): always creates a fresh Deal/
  // Application below — searching for an active Deal at all would risk
  // silently reactivating one.
  const existingActiveDeal =
    existingContact && !isDne
      ? await findActiveDeal({
          contactId: existingContact.id,
          offerId: offerRow.id,
          cohortId: cohort?.id ?? null,
        })
      : null;
  const existingPendingApplication = existingActiveDeal
    ? await findPendingApplication(existingActiveDeal.id)
    : null;

  if (
    existingPendingApplication &&
    answersEqual(existingPendingApplication.raw_answers, answers)
  ) {
    // True state-level no-op: same applicant, same active Deal, same
    // still-pending Application, byte-for-byte identical answers. Nothing
    // downstream (Contact, Deal/stage, Task due date, history) is touched.
    return jsonResponse({
      status: "submitted",
      applicationId: existingPendingApplication.id,
      dneAutoResolved: false,
    });
  }

  const contact = existingContact
    ? await touchExistingContact(existingContact)
    : await createContact({ firstName, lastName, email, phone });

  const { deal, reused } = existingActiveDeal
    ? { deal: existingActiveDeal, reused: true }
    : await createDeal({ contact, offer: offerRow, cohort, isDne: !!isDne });

  if (reused && !isDne) {
    // A fresh Deal's INSERT fires the real handle_deal_waitlist_sync()
    // Postgres trigger (supabase/schemas/02_functions.sql) automatically —
    // reusing an existing Deal writes nothing to "deals" at all, so that
    // trigger never fires for this path. Mirrors submitApplication.ts's own
    // explicit call here exactly (§13) — found missing during the Native
    // Application Intake real-infrastructure audit: without this, a
    // returning applicant whose application reuses an existing active
    // Opportunity would never have a compatible Waitlist Entry converted,
    // unlike a fresh applicant.
    await syncWaitlistForActiveDeal(deal);
  }

  const application = existingPendingApplication
    ? // Present but didn't match the exact-retry check above: the
      // applicant materially changed their answers before anyone
      // reviewed the pending Application. Update in place — same
      // Application row, same Deal, same Contact, same Task — only the
      // content Leif will actually see when reviewing changes.
      await updatePendingApplication(existingPendingApplication, answers)
    : await findOrCreateApplication({
        dealId: deal.id,
        answers,
        isDne: !!isDne,
      });

  // Review Application Task: never created for the DNE auto-resolve path
  // — there is nothing pending for Leif to decide, the outcome is already
  // durable. ensureReviewApplicationTask itself is idempotent (skips
  // creation if a pending one already exists), so the existing Task's due
  // date is never reset by a resubmission that reuses it — including the
  // update-in-place path just above.
  if (!isDne) {
    await ensureReviewApplicationTask(
      contact.id,
      `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
    );
  }

  return jsonResponse({
    status: "submitted",
    applicationId: application.id,
    dneAutoResolved: !!isDne,
  });
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(400, "Invalid JSON body");
    }

    try {
      if (body.action === "context") return await handleContext(body);
      if (body.action === "submit") return await handleSubmit(body);
      return createErrorResponse(400, "Unknown action");
    } catch (error) {
      console.error("public_application error:", error);
      return createErrorResponse(
        500,
        `Failed to process application: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }),
);
