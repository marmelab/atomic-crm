import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  docuSealWebhookPayloadSchema,
  PIPELINE_STEP,
  reportValidationFailure,
  summarizeZodError,
  withPipelineStep,
} from "../_shared/quoteWorkflow/index.ts";
import { takeSnapshot } from "../_shared/quoteWorkflow/takeSnapshot.ts";

async function notifyDiscord(embed: {
  title: string;
  description: string;
  color: number;
}) {
  try {
    let webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL") || "";
    if (!webhookUrl) {
      const { data } = await supabaseAdmin.rpc("get_discord_webhook_url");
      webhookUrl = data || "";
    }
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{ ...embed, timestamp: new Date().toISOString() }],
      }),
    });
  } catch (e) {
    console.warn("Discord notification failed:", e);
  }
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    try {
      const webhookSecret = Deno.env.get("DOCUSEAL_WEBHOOK_SECRET");
      if (!webhookSecret) {
        console.error("DOCUSEAL_WEBHOOK_SECRET not configured");
        return createErrorResponse(500, "Webhook secret not configured");
      }

      const authHeader =
        req.headers.get("x-docuseal-secret") ||
        req.headers.get("authorization");
      if (
        authHeader !== webhookSecret &&
        authHeader !== `Bearer ${webhookSecret}`
      ) {
        return createErrorResponse(401, "Invalid webhook secret");
      }

      const rawPayload = await req.json();

      // Phase 3: quarantine-policy validation. DocuSeal controls the
      // payload shape, so a mismatch is either a new event type we have
      // not seen before or a probe against the endpoint. We record it
      // in quote_validation_failures and ACK the webhook with 200 so
      // DocuSeal does not retry — but we stop processing it here.
      const parseResult = docuSealWebhookPayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        const summary = summarizeZodError(parseResult.error);
        await reportValidationFailure({
          supabase: supabaseAdmin,
          quoteId: null,
          boundary: "docuseal_webhook",
          schemaName: "docuSealWebhookPayloadSchema",
          policy: "quarantine",
          rawInput: rawPayload,
          validationError: summary,
          errorDetails: { issues: parseResult.error.issues },
        });
        return new Response(
          JSON.stringify({
            received: true,
            quarantined: true,
            error: "payload_schema_mismatch",
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
            status: 200,
          },
        );
      }
      const payload = parseResult.data;
      const eventType = payload.event_type || payload.type;
      const rawData = payload.data as Record<string, unknown> | undefined;
      const rawSubmitters = Array.isArray(rawData?.submitters)
        ? rawData.submitters as Array<Record<string, unknown>>
        : [];
      const candidateSlugs = Array.from(
        new Set(
          [
            typeof payload.data?.submission?.slug === "string"
              ? payload.data.submission.slug
              : null,
            typeof rawData?.slug === "string" ? rawData.slug : null,
            typeof payload.slug === "string" ? payload.slug : null,
            ...rawSubmitters.map((submitter) =>
              typeof submitter.slug === "string" ? submitter.slug : null
            ),
          ].filter((slug): slug is string => Boolean(slug)),
        ),
      );

      // DocuSeal CE sends submission ID in data.submission.id (form events)
      // or data.submission_id / payload.id (submission events)
      const submissionId = String(
        payload.data?.submission?.id ||
          payload.data?.submission_id ||
          rawData?.id ||
          rawSubmitters.find((submitter) =>
            submitter.submission_id != null
          )?.submission_id ||
          payload.submission_id ||
          payload.id,
      );

      console.log(
        "docuseal_webhook received:",
        eventType,
        "submission:",
        submissionId,
        "slugs:",
        candidateSlugs,
      );

      if (!submissionId && candidateSlugs.length === 0) {
        return createErrorResponse(400, "Missing submission_id or signing slug in payload");
      }

      const supabase = supabaseAdmin;

      // Find the quote by docuseal_submission_id first. If the webhook only
      // carries a submitter slug, fall back to matching docuseal_signing_url.
      let quote: {
        id: number;
        status: string;
        deal_id: number | null;
        quote_number: string | null;
        contact_id: number | null;
        company_id: number | null;
      } | null = null;
      let quoteError: unknown = null;

      if (submissionId) {
        const result = await supabase
          .from("quotes")
          .select("id, status, deal_id, quote_number, contact_id, company_id")
          .eq("docuseal_submission_id", submissionId)
          .single();
        quote = result.data;
        quoteError = result.error;
      }

      if ((!quote || quoteError) && candidateSlugs.length > 0) {
        for (const slug of candidateSlugs) {
          const slugResult = await supabase
            .from("quotes")
            .select("id, status, deal_id, quote_number, contact_id, company_id")
            .ilike("docuseal_signing_url", `%/s/${slug}`)
            .single();

          if (slugResult.data && !slugResult.error) {
            quote = slugResult.data;
            quoteError = null;
            console.warn(
              "docuseal_webhook: matched quote by signing slug fallback",
              {
                slug,
                quoteId: quote.id,
                submissionId,
                eventType,
              },
            );
            break;
          }
        }
      }

      if (quoteError || !quote) {
        console.error("Quote not found for webhook payload", {
          submissionId,
          candidateSlugs,
          eventType,
          submissionStatus: payload.data?.submission?.status || payload.data?.status || payload.status,
        });
        return new Response(JSON.stringify({ received: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // DocuSeal CE only sends form.* events (per submitter), not submission.* events.
      // Check data.submission.status to know if ALL parties have signed.
      const submissionStatus =
        payload.data?.submission?.status ||
        payload.data?.status ||
        payload.status;
      const submitterStatus = payload.data?.status;
      const submitterDeclinedAt = payload.data?.declined_at;
      const anyDeclinedSubmitter = rawSubmitters.some((submitter) =>
        submitter.status === "declined" || Boolean(submitter.declined_at)
      );
      const allPartiesSigned =
        submissionStatus === "completed" ||
        eventType === "complete_form";
      const isDeclinedEvent =
        eventType === "form.declined" ||
        eventType === "submission.declined" ||
        eventType === "decline_form" ||
        submissionStatus === "declined" ||
        submitterStatus === "declined" ||
        Boolean(submitterDeclinedAt) ||
        anyDeclinedSubmitter;
      const isViewedEvent =
        eventType === "form.viewed" ||
        eventType === "submission.viewed" ||
        eventType === "view_form";

      if ((eventType === "form.completed" || eventType === "complete_form") && allPartiesSigned) {
        // All parties have signed — mark as signed and trigger full flow
        const documentUrl =
          payload.data?.documents?.[0]?.url ||
          payload.data?.submission?.combined_document_url ||
          null;

        await supabase
          .from("quotes")
          .update({
            status: "signed",
            signed_at: new Date().toISOString(),
            ...(documentUrl ? { docuseal_document_url: documentUrl } : {}),
          })
          .eq("id", quote.id);

        // Fas 6A: snapshot the signed transition.
        await takeSnapshot({
          supabase,
          quoteId: quote.id,
          triggerEvent: "signed",
          oldStatus: quote.status,
          newStatus: "signed",
          initiatorSource: "docuseal_webhook",
          metadata: { submissionId, documentUrl },
        });

        // Fetch contact and company info for notifications
        const [contactResult, companyResult] = await Promise.all([
          quote.contact_id
            ? supabase
                .from("contacts")
                .select("first_name, last_name, email_jsonb")
                .eq("id", quote.contact_id)
                .single()
            : Promise.resolve({ data: null }),
          quote.company_id
            ? supabase
                .from("companies")
                .select("name")
                .eq("id", quote.company_id)
                .single()
            : Promise.resolve({ data: null }),
        ]);

        const contact = contactResult.data;
        const company = companyResult.data;
        const contactName = contact
          ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
          : "Kund";
        const emails = contact?.email_jsonb || [];
        const contactEmail = emails.length > 0 ? emails[0].email : null;
        const companyName = company?.name || "Okänt företag";
        const quoteNumber = quote.quote_number || `#${quote.id}`;

        // 1. Move deal to "won"
        if (quote.deal_id) {
          await supabase
            .from("deals")
            .update({ stage: "won" })
            .eq("id", quote.deal_id);
        }

        // 2. Discord notification handled by database trigger on deals.stage change

        // 3. Send confirmation email to customer
        try {
          const resendKey = Deno.env.get("RESEND_API_KEY");
          const fromEmail =
            Deno.env.get("RESEND_FROM_EMAIL") || "hej@axonadigital.se";
          if (resendKey && contactEmail) {
            const emailRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: `Axona Digital <${fromEmail}>`,
                to: contactEmail,
                subject: `Avtalsbekräftelse — ${quoteNumber}`,
                html: [
                  `<p>Hej ${contactName},</p>`,
                  `<p>Tack för att ni signerade avtalet! Vi har mottagit er signatur och avtalet är nu giltigt.</p>`,
                  `<p>Vi återkommer inom kort med nästa steg.</p>`,
                  `<p>Med vänlig hälsning,<br>Axona Digital AB</p>`,
                ].join("\n"),
              }),
            });

            if (!emailRes.ok) {
              const errBody = await emailRes.text();
              console.error("Resend API error:", emailRes.status, errBody);
            } else {
              console.log("Confirmation email sent to:", contactEmail);
            }

            await supabase.from("email_sends").insert({
              quote_id: quote.id,
              contact_id: quote.contact_id,
              company_id: quote.company_id,
              subject: `Avtalsbekräftelse — ${quoteNumber}`,
              to_email: contactEmail,
              status: "sent",
              sent_at: new Date().toISOString(),
              metadata: {
                source: "docuseal_completion",
                quote_id: quote.id,
              },
            });
          }
        } catch (emailErr) {
          console.error("Confirmation email failed:", emailErr);
        }
      } else if (isDeclinedEvent) {
        await supabase
          .from("quotes")
          .update({ status: "declined" })
          .eq("id", quote.id);

        // Fas 6A: snapshot the declined transition.
        await takeSnapshot({
          supabase,
          quoteId: quote.id,
          triggerEvent: "declined",
          oldStatus: quote.status,
          newStatus: "declined",
          initiatorSource: "docuseal_webhook",
          metadata: { submissionId, eventType },
        });

        await notifyDiscord({
          title: "Offert declined i DocuSeal",
          description: [
            `**Offert:** ${quote.quote_number || quote.id}`,
            `**Submission:** ${submissionId}`,
            `**Event:** ${eventType}`,
            `**Submission status:** ${submissionStatus || "okand"}`,
            `**Submitter status:** ${submitterStatus || "okand"}`,
            anyDeclinedSubmitter
              ? "**Declined submitter:** Ja"
              : null,
            payload.data?.decline_reason
              ? `**Reason:** ${String(payload.data.decline_reason)}`
              : null,
          ].filter(Boolean).join("\n"),
          color: 15548997,
        });
      } else if (isViewedEvent) {
        if (quote.status === "sent") {
          await supabase
            .from("quotes")
            .update({ status: "viewed" })
            .eq("id", quote.id);

          // Fas 6A: snapshot the viewed transition.
          await takeSnapshot({
            supabase,
            quoteId: quote.id,
            triggerEvent: "viewed",
            oldStatus: "sent",
            newStatus: "viewed",
            initiatorSource: "docuseal_webhook",
            metadata: { submissionId },
          });
        }
      }
      // form.completed with submission status != "completed" → Axona pre-sign, ignore

      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error) {
      console.error("docuseal_webhook error:", error);
      return new Response(
        JSON.stringify({ received: true, error: "processing_error" }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
          status: 200,
        },
      );
    }
  }),
);
