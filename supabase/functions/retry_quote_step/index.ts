import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getDocuSealBaseUrl } from "../_shared/serviceEndpoints.ts";
import {
  createSigningSubmission,
  DocuSealSubmissionError,
  PIPELINE_STEP,
  sendSigningEmail,
  withPipelineStep,
} from "../_shared/quoteWorkflow/index.ts";

/**
 * Retry a single failed pipeline step for a quote.
 *
 * Fas 6C scope — retryable steps in v1:
 *   generate_pdf   — allowed in status: draft, generated
 *   docuseal_submit — allowed in status: generated
 *   send_email      — allowed in status: sent, viewed (+ signing_url must be set)
 *
 * Auth: requires user JWT. Not a public endpoint.
 */

const RETRY_GUARD: Record<string, readonly string[]> = {
  generate_pdf: ["draft", "generated"],
  docuseal_submit: ["generated"],
  send_email: ["sent", "viewed"],
} as const;

const RETRYABLE_STEPS = Object.keys(RETRY_GUARD);

function isRetryable(stepName: string, quoteStatus: string): boolean {
  return RETRY_GUARD[stepName]?.includes(quoteStatus) ?? false;
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    // Require authenticated user JWT — sellers only.
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return createErrorResponse(401, "Missing authorization token");

    let userId: string | null = null;
    try {
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      if (!userData?.user) return createErrorResponse(401, "Unauthorized");
      userId = userData.user.id;
    } catch {
      return createErrorResponse(401, "Unauthorized");
    }

    try {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return createErrorResponse(400, "Invalid JSON body");
      }

      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return createErrorResponse(400, "Request body must be a JSON object");
      }

      const { quote_id: rawQuoteId, step_name: rawStepName } = body as Record<
        string,
        unknown
      >;

      const quoteId = Number(rawQuoteId);
      if (!rawQuoteId || isNaN(quoteId) || quoteId <= 0) {
        return createErrorResponse(400, "Missing or invalid quote_id");
      }

      const stepName = typeof rawStepName === "string" ? rawStepName : null;
      if (!stepName || !RETRYABLE_STEPS.includes(stepName)) {
        return createErrorResponse(
          400,
          `step_name must be one of: ${RETRYABLE_STEPS.join(", ")}`,
        );
      }

      const supabase = supabaseAdmin;

      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select(
          "id, status, deal_id, quote_number, contact_id, company_id, sales_id, " +
            "docuseal_submission_id, docuseal_signing_url, approval_token, " +
            "html_content, pdf_url, valid_until, total_amount, subtotal, " +
            "vat_amount, vat_rate, payment_terms, delivery_terms, " +
            "terms_and_conditions, generated_text, currency",
        )
        .eq("id", quoteId)
        .single();

      if (quoteError || !quote) {
        return createErrorResponse(404, "Quote not found");
      }

      if (!isRetryable(stepName, quote.status)) {
        return new Response(
          JSON.stringify({
            success: false,
            code: "step_not_retryable",
            error: `Cannot retry '${stepName}' when quote status is '${quote.status}'`,
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      // Count prior attempts so the new row carries an accurate attempt_number.
      const { count: priorAttempts } = await supabase
        .from("quote_pipeline_steps")
        .select("*", { count: "exact", head: true })
        .eq("quote_id", quoteId)
        .eq("step_name", stepName);

      const attemptNumber = (priorAttempts ?? 0) + 1;
      const retryMetadata = {
        retry: true,
        attempt_number: attemptNumber,
        triggered_by: "crm_user",
        user_id: userId,
      };

      let result: Record<string, unknown> = {};

      // ------------------------------------------------------------------ //
      // generate_pdf
      // ------------------------------------------------------------------ //
      if (stepName === "generate_pdf") {
        await withPipelineStep(
          {
            supabase,
            quoteId,
            stepName: PIPELINE_STEP.GENERATE_PDF,
            metadata: retryMetadata,
          },
          async () => {
            const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
            const serviceRoleKey =
              Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
            const pdfResponse = await fetch(
              `${supabaseUrl}/functions/v1/generate_quote_pdf`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({ quote_id: quoteId }),
              },
            );
            if (!pdfResponse.ok) {
              const errText = await pdfResponse.text();
              throw new Error(
                `generate_quote_pdf failed: ${pdfResponse.status} ${errText}`,
              );
            }
            const pdfResult = await pdfResponse.json();
            result = { pdf_url: pdfResult.pdf_url };
          },
        );
      }

      // ------------------------------------------------------------------ //
      // docuseal_submit
      // ------------------------------------------------------------------ //
      if (stepName === "docuseal_submit") {
        let contactName = "";
        let contactEmail = "";
        if (quote.contact_id) {
          const { data: contact } = await supabase
            .from("contacts")
            .select("first_name, last_name, email_jsonb")
            .eq("id", quote.contact_id)
            .single();
          if (contact) {
            contactName = `${contact.first_name} ${contact.last_name}`.trim();
            const emails = contact.email_jsonb || [];
            if (emails.length > 0) contactEmail = emails[0].email;
          }
        }
        if (!contactEmail) {
          return createErrorResponse(422, "No email found for the contact");
        }

        let companyName = "";
        let companyOrgNumber = "";
        if (quote.company_id) {
          const { data: company } = await supabase
            .from("companies")
            .select("name, org_number")
            .eq("id", quote.company_id)
            .single();
          companyName = company?.name || "";
          companyOrgNumber = company?.org_number || "";
        }

        const { data: lineItems } = await supabase
          .from("quote_line_items")
          .select("description, quantity, unit_price, total")
          .eq("quote_id", quoteId)
          .order("sort_order");

        const crmPublicUrl =
          Deno.env.get("CRM_PUBLIC_URL") ||
          Deno.env.get("ALLOWED_ORIGIN") ||
          "http://localhost:5173";
        const proposalUrl = quote.approval_token
          ? `${crmPublicUrl}/quote.html?id=${quote.id}&token=${quote.approval_token}`
          : `${crmPublicUrl}/quote.html?id=${quote.id}`;

        const docusealApiKey = Deno.env.get("DOCUSEAL_API_KEY");
        const docusealTemplateId = Deno.env.get("DOCUSEAL_TEMPLATE_ID");
        if (!docusealApiKey || !docusealTemplateId) {
          return createErrorResponse(
            500,
            "DOCUSEAL_API_KEY or DOCUSEAL_TEMPLATE_ID not configured",
          );
        }

        try {
          const signingResult = await withPipelineStep(
            {
              supabase,
              quoteId,
              stepName: PIPELINE_STEP.DOCUSEAL_SUBMIT,
              metadata: retryMetadata,
            },
            () =>
              createSigningSubmission({
                supabase,
                initiator: { source: "crm_manual" },
                quote: {
                  id: quote.id,
                  quote_number: quote.quote_number,
                  valid_until: quote.valid_until,
                  total_amount: quote.total_amount,
                  subtotal: quote.subtotal,
                  vat_amount: quote.vat_amount,
                  vat_rate: quote.vat_rate,
                  payment_terms: quote.payment_terms,
                  delivery_terms: quote.delivery_terms,
                  terms_and_conditions: quote.terms_and_conditions,
                  generated_text: quote.generated_text,
                  currency: quote.currency,
                  docuseal_submission_id: quote.docuseal_submission_id,
                  docuseal_signing_url: quote.docuseal_signing_url,
                  status: quote.status,
                },
                company: { name: companyName, org_number: companyOrgNumber },
                contact: { name: contactName, email: contactEmail },
                lineItems: lineItems || [],
                proposalUrl,
                docusealApiKey,
                docusealTemplateId: Number(docusealTemplateId),
                docusealBaseUrl: getDocuSealBaseUrl(),
              }),
          );
          result = {
            submission_id: signingResult.submissionId,
            signing_url: signingResult.signingUrl,
            reused: signingResult.reusedExistingSubmission,
          };
        } catch (err) {
          if (err instanceof DocuSealSubmissionError) {
            return new Response(
              JSON.stringify({
                success: false,
                code: err.status === 409 ? "quote_declined" : "docuseal_error",
                error:
                  err.status === 409
                    ? "Quote is declined — recall to generated first"
                    : `DocuSeal error: ${err.body}`,
              }),
              {
                status: err.status === 409 ? 409 : 502,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              },
            );
          }
          throw err;
        }
      }

      // ------------------------------------------------------------------ //
      // send_email
      // ------------------------------------------------------------------ //
      if (stepName === "send_email") {
        if (!quote.docuseal_signing_url) {
          return new Response(
            JSON.stringify({
              success: false,
              code: "missing_signing_url",
              error: "No signing URL set — run docuseal_submit first",
            }),
            {
              status: 409,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        let contactName = "";
        let contactEmail = "";
        if (quote.contact_id) {
          const { data: contact } = await supabase
            .from("contacts")
            .select("first_name, last_name, email_jsonb")
            .eq("id", quote.contact_id)
            .single();
          if (contact) {
            contactName = `${contact.first_name} ${contact.last_name}`.trim();
            const emails = contact.email_jsonb || [];
            if (emails.length > 0) contactEmail = emails[0].email;
          }
        }
        if (!contactEmail) {
          return createErrorResponse(422, "No email found for the contact");
        }

        let companyName = "";
        if (quote.company_id) {
          const { data: company } = await supabase
            .from("companies")
            .select("name")
            .eq("id", quote.company_id)
            .single();
          companyName = company?.name || "";
        }

        const crmPublicUrl =
          Deno.env.get("CRM_PUBLIC_URL") ||
          Deno.env.get("ALLOWED_ORIGIN") ||
          "http://localhost:5173";
        const proposalUrl = quote.approval_token
          ? `${crmPublicUrl}/quote.html?id=${quote.id}&token=${quote.approval_token}`
          : `${crmPublicUrl}/quote.html?id=${quote.id}`;
        const quoteNumber = quote.quote_number || `#${quote.id}`;

        let emailResult: { sent: boolean; skipped: boolean; reason?: string } =
          { sent: false, skipped: false };

        await withPipelineStep(
          {
            supabase,
            quoteId,
            stepName: PIPELINE_STEP.SEND_EMAIL,
            metadata: retryMetadata,
          },
          async () => {
            emailResult = await sendSigningEmail({
              supabase,
              quoteId,
              contactId: quote.contact_id,
              companyId: quote.company_id,
              salesId: quote.sales_id,
              contactName,
              contactEmail,
              companyName,
              quoteNumber,
              signingUrl: quote.docuseal_signing_url!,
              proposalUrl,
              strictReservation: true,
            });
          },
        );

        result = emailResult;
      }

      return new Response(
        JSON.stringify({ success: true, step: stepName, result }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    } catch (error) {
      console.error("retry_quote_step error:", error);
      return createErrorResponse(500, "Failed to retry step");
    }
  }),
);
