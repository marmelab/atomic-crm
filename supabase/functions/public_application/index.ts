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
// Application Intake Atomicity + Idempotency slice: handleSubmit's actual
// multi-table write (Contact/Deal/Waitlist/Application/Task) now happens
// inside ONE Postgres transaction — supabase/schemas/02_functions.sql's
// submit_public_application(), invoked below via supabaseAdmin.rpc(). This
// function still owns every pre-write concern that benefits from staying
// in TypeScript with a clean public error shape: honeypot, name/email/
// answer-length validation, and full offer/cohort existence + open-window
// validation (the RPC re-validates offer/cohort structurally as a
// defense-in-depth backstop, but does not duplicate the Denver-timezone
// window logic — see that function's own header).
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

  // Application Intake Atomicity + Idempotency slice: everything past this
  // point — Contact resolve/create, Deal resolve/create, Waitlist sync for
  // a reused Deal, Application resolve/update/create, Review Task ensure —
  // used to be a sequence of independent PostgREST round-trips with no
  // shared transaction, so a failure partway through could leave durable
  // partial state no retry could always repair (see
  // supabase/schemas/02_functions.sql's submit_public_application() header
  // for the exact failure mode this replaced). It is now ONE Postgres
  // function call, invoked here as the sole write for this whole flow —
  // either the entire logical intake commits, or none of it does. Offer/
  // cohort validation (including the Denver-timezone open-window logic
  // above) deliberately stays here, before ever calling the function: a
  // rejection here means zero calls into it, and it also re-validates
  // offer/cohort itself as a defense-in-depth backstop (see that
  // function's own header).
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
    "submit_public_application",
    {
      p_offer_id: offerRow.id,
      p_cohort_id: cohort?.id ?? null,
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email,
      p_phone: phone,
      p_answers: answers,
    },
  );

  if (rpcError) {
    // The function's own defense-in-depth checks are sentinel message
    // strings (see its header) — translated back to the exact same public
    // response shape the pre-RPC validation above already uses for these
    // cases. Any other error is an unexpected internal failure: logged
    // with full detail server-side, never leaked to the public caller.
    if (rpcError.message.includes("offer_invalid")) {
      return jsonResponse({ status: "offer-invalid" });
    }
    if (rpcError.message.includes("cohort_invalid")) {
      return jsonResponse({ status: "cohort-invalid" });
    }
    console.error(
      "public_application submit_public_application error:",
      rpcError,
    );
    return createErrorResponse(500, "Failed to process application");
  }

  const result = rpcResult as {
    status: string;
    application_id: number;
    dne_auto_resolved: boolean;
  };

  return jsonResponse({
    status: "submitted",
    applicationId: result.application_id,
    dneAutoResolved: result.dne_auto_resolved,
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
