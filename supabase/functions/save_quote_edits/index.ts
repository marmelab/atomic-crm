import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  reportValidationFailure,
  saveQuoteContent,
  SaveQuoteContentError,
  saveQuoteEditsPayloadSchema,
  summarizeZodError,
} from "../_shared/quoteWorkflow/index.ts";
import { takeSnapshot } from "../_shared/quoteWorkflow/takeSnapshot.ts";

/**
 * Save inline quote edits made in the WYSIWYG HTML editor.
 *
 * Phase 4 — this function is now a thin authentication wrapper around
 * the shared `saveQuoteContent` helper. All deep-merge rules and
 * status guards live in the helper so both this endpoint (public
 * editor, write_token auth) and `save_quote_content` (CRM seller,
 * user JWT auth) end up with identical merged-sections output for
 * identical inputs.
 *
 * Auth: validated via quotes.write_token. No user JWT needed.
 *
 * POST { quote_id: number, write_token: string, sections: object }
 *  → validates write_token against quotes.write_token
 *  → delegates merge + update + PDF regeneration to saveQuoteContent
 *  → returns { success: true, pdf_url: string | null }
 */

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (_req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return createErrorResponse(400, "Invalid JSON body");
    }

    // Phase 3: fail-fast Zod validation of the incoming payload. The
    // public editor should only ever send the shape the schema describes;
    // anything else is either a client bug or a probe worth logging.
    const parseResult = saveQuoteEditsPayloadSchema.safeParse(rawBody);
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
        boundary: "save_quote_edits_payload",
        schemaName: "saveQuoteEditsPayloadSchema",
        policy: "fail_fast",
        rawInput: rawBody,
        validationError: summary,
        errorDetails: { issues: parseResult.error.issues },
      });
      return createErrorResponse(400, `Invalid payload: ${summary}`);
    }

    const { quote_id, write_token, sections } = parseResult.data;

    // Write-token authentication happens BEFORE we touch the shared
    // helper. The helper assumes the caller is already authorized for
    // this specific quote — its only remaining job is to enforce the
    // status guard and run the merge.
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from("quotes")
      .select("id, write_token")
      .eq("id", quote_id)
      .single();

    if (quoteError || !quote) {
      return createErrorResponse(404, "Quote not found");
    }
    if (quote.write_token !== write_token) {
      return createErrorResponse(403, "Invalid write token");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    async function regeneratePdf(qid: number | string): Promise<string | null> {
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
        console.error("save_quote_edits: PDF regeneration failed:", e);
        return null;
      }
    }

    try {
      const result = await saveQuoteContent({
        supabase: supabaseAdmin,
        quoteId: quote_id,
        sections,
        initiator: { source: "public_editor", writeTokenVerified: true },
        regeneratePdf,
        takeSnapshotFn: (opts) =>
          takeSnapshot({ supabase: supabaseAdmin, ...opts }),
      });

      return new Response(
        JSON.stringify({ success: result.success, pdf_url: result.pdfUrl }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    } catch (err) {
      if (err instanceof SaveQuoteContentError) {
        return createErrorResponse(err.status, err.message);
      }
      console.error("save_quote_edits: unexpected error:", err);
      return createErrorResponse(
        500,
        err instanceof Error ? err.message : "Unknown error",
      );
    }
  }),
);
