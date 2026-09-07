// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { syncExpectedSessionWindows } from "./syncExpectedSessionWindows.ts";
import { assignEnrollmentExpectedSessions } from "./assignEnrollmentExpectedSessions.ts";
import { detectClientSessionCadenceIssues } from "./detectClientSessionCadenceIssues.ts";

// Client + Session Operations cadence correction — the read-only Google
// Calendar ingestion this slice's product correction requires (Leif's
// real "Year Planning" calendar; see this slice's own report for the
// name discrepancy with the originally-specified "Year Tracking"). This
// is a Google Calendar "Secret address in iCal format" pull — Google
// Calendar's own built-in read-only, no-OAuth integration point — chosen
// as the minimum safe mechanism for this specific use case over a full
// OAuth integration (no Google Cloud project/consent screen/refresh-token
// storage needed). Never writes back to the calendar.
//
// Requires two env vars, set via `npx supabase secrets set` for a
// deployed project (see this slice's own report for exact values and
// where each comes from in Google Calendar's own Settings page):
//   YEAR_PLANNING_CALENDAR_ICS_URL — the calendar's "Secret address in
//     iCal format" (Settings -> that calendar -> Integrate calendar).
//     Never printed/logged.
//   YEAR_PLANNING_CALENDAR_ID — the calendar's own stable id (the
//     "...@group.calendar.google.com" string, same Settings page) — used
//     only as this ingestion's own stable identity key, never as a
//     display-name match.
// Without them this function returns a clear "not configured" error
// rather than silently skipping the sync.
//
// SCHEDULING — corrected after inspection (do not reintroduce
// Deno.cron): a hosted Supabase Edge Function is a request-driven
// isolate, not a durable long-running process. Supabase's OWN scheduling
// docs (supabase.com/docs/guides/functions/schedule-functions) never
// mention Deno.cron as the mechanism — they document pg_cron + pg_net
// (Supabase Cron) invoking the function's HTTP endpoint on a schedule,
// with the invocation's own auth token read from Supabase Vault at
// execution time, never hardcoded in SQL. Supabase's own troubleshooting
// docs on Edge Function shutdown behavior describe isolates as
// short-lived and explicitly recommend external scheduling + durable
// state over in-process timers for exactly this reason. This function is
// therefore invoked ONLY over HTTP — by the `cron.schedule(...)` job in
// migration 20260906070000 (every 6 hours, via pg_net, once Leif enables
// the pg_cron extension — see that migration's own header) — and, with
// the same secret, directly by hand for a manual/testing trigger.
//
// Auth: this function's own gateway JWT check is disabled (see
// supabase/config.toml — same pattern as acuity_webhook/stripe_webhook,
// every function invoked by a non-CRM-session caller) since neither
// pg_net nor a manual curl carries a real user's Supabase session. In
// its place, every request must carry a shared secret this function
// checks itself, mirroring acuity_webhook's own "fail closed if
// unconfigured, reject if wrong" shape:
//   x-cron-secret: <CRON_INVOKE_SECRET>
// Never logged, never echoed back in any response.
//
// Three steps, in order, every run: (1) syncExpectedSessionWindows
// upserts the shared calendar windows; (2) assignEnrollmentExpectedSessions
// turns those into each active Enrollment's own frozen, sequential
// 12-slot Service Period cadence (append-only — see its own header for
// why calendar edits/deletions never reshuffle an already-assigned
// slot); (3) detectClientSessionCadenceIssues compares each Enrollment's
// own slots against actual sessions. Idempotent by construction
// regardless of how many times (or how close together) this fires: each
// step finds-or-creates by the database's own unique indexes and never
// creates a second pending Task for an issue that already has one — all
// three directly unit-tested for exactly this (see their own *.test.ts
// files) — so an overlapping or retried pg_cron invocation can never
// duplicate a window, a slot assignment, or an issue.
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const runSync = async () => {
  const icsUrl = Deno.env.get("YEAR_PLANNING_CALENDAR_ICS_URL");
  const calendarId = Deno.env.get("YEAR_PLANNING_CALENDAR_ID");
  if (!icsUrl || !calendarId) {
    throw new Error("Year Planning calendar sync is not configured.");
  }

  // Every Offer with client-session tracking configured (currently only
  // The Living Example) shares the same one calendar — see
  // offers.client_session_acuity_appointment_type_id's own schema
  // comment. A second individual Offer could opt in later without a
  // schema/code change here.
  const { data: offers } = await supabaseAdmin
    .from("offers")
    .select("id, client_session_acuity_appointment_type_id");
  const trackedOffers = (offers ?? []).filter(
    (offer) => offer.client_session_acuity_appointment_type_id != null,
  );

  const response = await fetch(icsUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch the Year Planning calendar feed: ${response.status}`,
    );
  }
  const icsText = await response.text();

  const syncResults = [];
  for (const offer of trackedOffers) {
    syncResults.push(
      await syncExpectedSessionWindows({
        icsText,
        offerId: offer.id,
        calendarId,
      }),
    );
  }

  const assignment = await assignEnrollmentExpectedSessions();
  const detection = await detectClientSessionCadenceIssues();

  return { syncResults, assignment, detection };
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    const cronSecret = Deno.env.get("CRON_INVOKE_SECRET");
    if (!cronSecret) {
      return createErrorResponse(
        503,
        "Cron invocation secret is not configured.",
      );
    }
    if (req.headers.get("x-cron-secret") !== cronSecret) {
      // Deliberately generic — never confirm/deny which part of the
      // check failed, same convention as acuity_webhook's own signature
      // check.
      return createErrorResponse(401, "Invalid cron invocation secret.");
    }

    try {
      const result = await runSync();
      return jsonResponse(result);
    } catch (error) {
      console.error(
        "sync_year_planning_calendar error:",
        error instanceof Error ? error.message : "Unknown error",
      );
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }),
);
