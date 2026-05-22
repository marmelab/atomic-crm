import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  reportValidationFailure,
  saveQuoteContent,
  SaveQuoteContentError,
  saveQuoteContentPayloadSchema,
  summarizeZodError,
} from "../_shared/quoteWorkflow/index.ts";
import { takeSnapshot } from "../_shared/quoteWorkflow/takeSnapshot.ts";

/**
 * Save quote content from the CRM seller editor.
 *
 * Phase 4 — this is the authenticated-seller counterpart to
 * `save_quote_edits` (which is called by the public WYSIWYG editor with
 * a write_token). Both delegate to the same `saveQuoteContent` shared
 * helper so there is exactly one backend code path that mutates
 * `quotes.generated_sections`.
 *
 * Auth model:
 *   1. AuthMiddleware + UserMiddleware enforce a valid Supabase JWT.
 *   2. We resolve the user's sales row via getUserSale. No sales row =
 *      401 (caller is authenticated but not registered in the CRM).
 *   3. Per-quote ownership: the loaded quote's sales_id must match the
 *      caller's sales id, OR the caller must be an administrator.
 *      supabaseAdmin bypasses RLS, so this explicit check is the only
 *      thing standing between a valid JWT and arbitrary write access
 *      to other sellers' quotes.
 *
 * POST { quote_id: number, sections: object }
 *   → merges sections with existing generated_sections via the shared
 *     helper's deep-merge rules
 *   → regenerates the HTML quote via generate_quote_pdf
 *   → returns { success: true, pdf_url: string | null }
 */

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }

        let rawBody: unknown;
        try {
          rawBody = await req.json();
        } catch {
          return createErrorResponse(400, "Invalid JSON body");
        }

        // Phase 3: fail-fast Zod validation of the incoming payload.
        // Caller sees a 400 with a clear error summary; the failing
        // payload is persisted to quote_validation_failures so we can
        // audit which clients are sending malformed requests.
        const parseResult = saveQuoteContentPayloadSchema.safeParse(rawBody);
        if (!parseResult.success) {
          const summary = summarizeZodError(parseResult.error);
          const quoteIdFromRaw =
            rawBody &&
            typeof rawBody === "object" &&
            "quote_id" in (rawBody as Record<string, unknown>)
              ? Number((rawBody as Record<string, unknown>).quote_id)
              : null;
          await reportValidationFailure({
            supabase: supabaseAdmin,
            quoteId: Number.isFinite(quoteIdFromRaw) ? quoteIdFromRaw : null,
            boundary: "save_quote_content_payload",
            schemaName: "saveQuoteContentPayloadSchema",
            policy: "fail_fast",
            rawInput: rawBody,
            validationError: summary,
            errorDetails: { issues: parseResult.error.issues },
          });
          return createErrorResponse(400, `Invalid payload: ${summary}`);
        }

        const { quote_id, sections } = parseResult.data;

        // Resolve the caller's sales row. Authenticated users without a
        // sales record are not CRM operators and have no business
        // mutating quote content.
        const callerSale = await getUserSale(user);
        if (!callerSale) {
          return createErrorResponse(
            401,
            "Caller is not registered as a CRM sales user",
          );
        }

        // Per-quote ownership check. supabaseAdmin bypasses RLS, so
        // this is the only thing protecting quotes that belong to
        // other sellers from being mutated by a valid JWT.
        // Administrators bypass the ownership requirement.
        const { data: ownership, error: ownershipError } = await supabaseAdmin
          .from("quotes")
          .select("id, sales_id")
          .eq("id", quote_id)
          .single();

        if (ownershipError || !ownership) {
          return createErrorResponse(404, "Quote not found");
        }

        const isOwner = ownership.sales_id === callerSale.id;
        const isAdmin = callerSale.administrator === true;
        if (!isOwner && !isAdmin) {
          console.warn("save_quote_content: forbidden write attempt", {
            quoteId: ownership.id,
            quoteSalesId: ownership.sales_id,
            callerSalesId: callerSale.id,
            callerUserId: user.id,
          });
          return createErrorResponse(
            403,
            "You do not have permission to edit this quote",
          );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        async function regeneratePdf(
          qid: number | string,
        ): Promise<string | null> {
          try {
            const res = await fetch(
              `${supabaseUrl}/functions/v1/generate_quote_pdf`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({ quote_id: qid }),
              },
            );
            if (!res.ok) return null;
            const data = (await res.json()) as { pdf_url?: string };
            return data.pdf_url ?? null;
          } catch (e) {
            console.error("save_quote_content: PDF regeneration failed:", e);
            return null;
          }
        }

        try {
          // user is guaranteed non-null by UserMiddleware; the access
          // check above also failed loudly if the sales record was missing.
          const result = await saveQuoteContent({
            supabase: supabaseAdmin,
            quoteId: quote_id,
            sections,
            initiator: { source: "crm_seller", userId: user.id },
            regeneratePdf,
            takeSnapshotFn: (opts) =>
              takeSnapshot({ supabase: supabaseAdmin, ...opts }),
          });

          return new Response(
            JSON.stringify({
              success: result.success,
              pdf_url: result.pdfUrl,
            }),
            {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        } catch (err) {
          if (err instanceof SaveQuoteContentError) {
            return createErrorResponse(err.status, err.message);
          }
          console.error("save_quote_content: unexpected error:", err);
          return createErrorResponse(
            500,
            err instanceof Error ? err.message : "Unknown error",
          );
        }
      }),
    ),
  ),
);
