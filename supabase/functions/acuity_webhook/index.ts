// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { verifyAcuitySignature } from "./acuitySignature.ts";
import { fetchAcuityAppointment } from "./acuityApi.ts";
import {
  handleCanceled,
  handleRescheduled,
  handleScheduled,
  jsonResponse,
} from "./acuitySalesCallHandlers.ts";
import {
  handleClientSessionRescheduled,
  handleClientSessionScheduled,
  tryHandleClientSessionCanceled,
} from "./acuityClientSessionHandlers.ts";
import { resolveOfferForClientSession } from "./acuityClientSessionMatching.ts";

// Live Acuity Connection slice — the production webhook receiver.
// Business rules here MIRROR (do not share code with — Deno/Edge Functions
// don't import from src/) src/components/atomic-crm/sales-calls/
// acuityBookingService.ts + matchAcuityBooking.ts + bookSalesCall.ts +
// rescheduleSalesCall.ts + cancelSalesCall.ts, the FakeRest/dev-testable
// "logic of record" for this same slice — exhaustively unit-tested there
// with fixtures, and this function's own logic is now split across
// acuitySignature.ts / acuityApi.ts / acuityMatching.ts /
// acuitySalesCallHandlers.ts and unit-tested the same way
// supabase/functions/postmark/ already is (see this directory's own
// *.test.ts files). Uses supabaseAdmin (service-role, bypasses RLS) the
// same way postmark/public_application do, since Acuity is an external
// caller with no CRM session — every table's RLS is `to authenticated`
// only.
//
// Trust model: Acuity signs every webhook POST with an `x-acuity-signature`
// header (base64 HMAC-SHA256 of the raw body, using the same API key
// already required below) — verified in verifyAcuitySignature() before any
// other processing. This is the complete mechanism Acuity's own API
// supports; there is no stronger option (no nonce, no timestamp binding).
// The webhook body itself is otherwise nearly inert by design even before
// signature verification: it never carries appointment data (see
// acuityApi.ts's own header) — only {action, id, calendarID,
// appointmentTypeID} — so nothing is ever recorded from it directly; every
// write is driven by a follow-up authenticated GET to Acuity's own API
// using OUR credentials. A rejected/failed GET (see acuityApi.ts) never
// falls back to trusting the webhook body's own fields instead.
//
// Requires two secrets, set via `npx supabase secrets set` for a deployed
// project (see this repo's root .env.example for the exact names/values
// and where each one comes from in Acuity's dashboard):
//   ACUITY_USER_ID / ACUITY_API_KEY
// Without them this function returns a clear "not configured" error
// rather than fabricating appointment data or skipping verification.
//
// NOT LIVE-CONNECTED as of this slice. Two things remain, neither of which
// this session can do (no Acuity account access, no live/deployed
// Supabase project reachable from here — see this slice's own report):
//  1. The two secrets above, set on a real deployed Supabase project.
//  2. A webhook actually registered in Acuity's own dashboard (Business
//     Settings -> Integrations -> API) pointing at this function's
//     deployed URL.
//
// Local smoke test once (1) is set locally (`supabase functions serve
// --env-file supabase/functions/.env.local`, see .env.example) — the
// signature must be computed with the SAME API key, since this function
// now verifies it before doing anything else:
//
//   BODY='action=scheduled&id=12345&calendarID=1&appointmentTypeID=67890'
//   SIG=$(node -e "console.log(require('crypto').createHmac('sha256', process.env.ACUITY_API_KEY).update(process.env.BODY).digest('base64'))")
//   curl -i --location --request POST \
//     'http://127.0.0.1:54321/functions/v1/acuity_webhook' \
//     --header 'Content-Type: application/x-www-form-urlencoded' \
//     --header "x-acuity-signature: $SIG" \
//     --data "$BODY"

type AcuityAction = "scheduled" | "rescheduled" | "canceled" | "changed";

const parseBody = (
  rawBody: string,
  contentType: string,
): Record<string, string> => {
  if (contentType.includes("application/json")) {
    return JSON.parse(rawBody) as Record<string, string>;
  }
  // Acuity always sends application/x-www-form-urlencoded (confirmed
  // against Acuity's own webhook docs) — JSON support above exists only
  // for local/manual testing convenience.
  return Object.fromEntries(new URLSearchParams(rawBody).entries());
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    const userId = Deno.env.get("ACUITY_USER_ID");
    const apiKey = Deno.env.get("ACUITY_API_KEY");
    if (!userId || !apiKey) {
      // Never fabricate appointment data and never skip signature
      // verification — if credentials aren't configured, fail closed with
      // a clear, non-secret error.
      return createErrorResponse(
        503,
        "Acuity API credentials are not configured.",
      );
    }

    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-acuity-signature");
    const verified = await verifyAcuitySignature(
      rawBody,
      signatureHeader,
      apiKey,
    );
    if (!verified) {
      // Deliberately generic — never confirm/deny which part of the check
      // failed, and never echo the received signature back.
      return createErrorResponse(401, "Invalid webhook signature.");
    }

    let body: Record<string, string>;
    try {
      body = parseBody(rawBody, req.headers.get("content-type") ?? "");
    } catch {
      return createErrorResponse(400, "Invalid request body");
    }

    const action = body.action as AcuityAction | undefined;
    const appointmentId = body.id;
    if (!action || !appointmentId) {
      return createErrorResponse(400, "Missing action or appointment id");
    }

    // "changed" also fires for incidental edits (email/forms updated), not
    // only lifecycle transitions — Acuity's own scheduled/rescheduled/
    // canceled webhooks already cover the events this CRM cares about, so
    // "changed" is deliberately a no-op rather than risking a spurious
    // rebooking on every minor edit.
    if (action === "changed") {
      return jsonResponse({ status: "ignored-changed-event" });
    }

    try {
      if (action === "canceled") {
        // Client + Session Operations slice A: Acuity's own "canceled"
        // webhook body carries no appointment type — only the id — so
        // routing here is by "does a client_sessions row exist for this
        // id", not by type. Tried FIRST, but only ever finds a match for
        // an id this handler itself created; handleCanceled (sales-call)
        // is completely untouched and runs exactly as before when it
        // doesn't.
        const sessionResult =
          await tryHandleClientSessionCanceled(appointmentId);
        if (sessionResult) return sessionResult;
        return await handleCanceled(appointmentId);
      }

      const appointment = await fetchAcuityAppointment(appointmentId, {
        userId,
        apiKey,
      });
      if (!appointment) {
        return createErrorResponse(
          503,
          "The appointment could not be fetched from Acuity.",
        );
      }

      // Client + Session Operations slice A: a PAID CLIENT SESSION
      // appointment type (e.g. The Living Example's real "Zoom 1:1",
      // 90522599) is routed entirely to its own handlers, structurally
      // never reaching sales_calls/resolve_sales_call Task/Opportunity
      // sales-stage logic — see acuityClientSessionMatching.ts's own
      // header comment. Checked before the sales-call branches below,
      // which remain completely unchanged for every other appointment
      // type.
      const clientSessionOffer = await resolveOfferForClientSession(
        String(appointment.appointmentTypeID),
      );
      if (clientSessionOffer) {
        if (action === "scheduled") {
          return await handleClientSessionScheduled(appointment, appointmentId);
        }
        if (action === "rescheduled") {
          return await handleClientSessionRescheduled(
            appointment,
            appointmentId,
          );
        }
        return createErrorResponse(400, `Unknown action: ${action}`);
      }

      if (action === "scheduled") {
        return await handleScheduled(appointment, appointmentId);
      }
      if (action === "rescheduled") {
        return await handleRescheduled(appointment, appointmentId);
      }
      return createErrorResponse(400, `Unknown action: ${action}`);
    } catch (error) {
      // Never log the request body, headers, or credentials — only a
      // developer-facing message safe to appear in Supabase's function logs.
      console.error(
        "acuity_webhook error:",
        error instanceof Error ? error.message : "Unknown error",
      );
      return createErrorResponse(
        500,
        `Failed to process Acuity webhook: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }),
);
