import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  buildCallLogsContext,
  buildEmailContext,
  buildEnrichmentContext,
  buildMeetingContext,
  buildQuoteGenerationPrompts,
  fetchRecentCallLogs,
} from "../_shared/quoteGeneration.ts";
import {
  enrichSectionsForOrchestration,
  generateSections,
  PIPELINE_STEP,
  QUOTE_STATUS,
  withPipelineStep,
} from "../_shared/quoteWorkflow/index.ts";

/**
 * Orchestrate Proposal Generation
 *
 * Called automatically by a DB trigger (via pg_net) when a deal's stage
 * changes to "generating-proposal". Can also be called manually.
 *
 * Flow:
 * 1. Validate deal data (contact email, meeting analysis or line items)
 * 2. Auto-create a quote linked to the deal
 * 3. Generate AI text (calls generate_quote_text logic inline)
 * 4. Generate PDF (calls generate_quote_pdf logic inline)
 * 5. Post to Discord with Approve / Needs Edits links
 *
 * Auth: Accepts service_role key (from DB trigger) or user JWT.
 */

interface DealPayload {
  deal_id: number;
  company_id?: number;
  sales_id?: number;
  deal_name?: string;
  deal_amount?: number;
  deal_category?: string;
}

/** Send a Discord notification via Bot API (supports buttons) or webhook fallback. */
async function notifyDiscord(
  embed: {
    title: string;
    description: string;
    color: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
  },
  buttons?: Array<{ label: string; url: string }>,
) {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || "";
  const channelId = Deno.env.get("DISCORD_CHANNEL_ID") || "";

  const embedPayload = { ...embed, timestamp: new Date().toISOString() };

  // Use Bot API when we have bot token + channel (supports link buttons)
  if (botToken && channelId) {
    const payload: Record<string, unknown> = {
      embeds: [embedPayload],
    };

    if (buttons && buttons.length > 0) {
      payload.components = [
        {
          type: 1,
          components: buttons.map((btn) => ({
            type: 2,
            style: 5,
            label: btn.label,
            url: btn.url,
          })),
        },
      ];
    }

    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      console.error(
        `Discord Bot API failed: ${res.status} ${await res.text()}`,
      );
    }
    return;
  }

  // Fallback: webhook (no button support, links go in embed text)
  let webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL") || "";

  if (!webhookUrl) {
    const { data } = await supabaseAdmin.rpc("get_discord_webhook_url");
    webhookUrl = data || "";
  }

  if (!webhookUrl) {
    console.warn("orchestrate_proposal: no discord webhook URL configured");
    return;
  }

  // Append button links as text in description when using webhook
  if (buttons && buttons.length > 0) {
    const linkLines = buttons
      .map((btn) => `**${btn.label}:** ${btn.url}`)
      .join("\n");
    embedPayload.description += `\n\n${linkLines}`;
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embedPayload] }),
  });
}

/** Post an error/warning to Discord */
async function notifyDiscordError(dealName: string, message: string) {
  await notifyDiscord({
    title: "Proposal Generation Failed",
    description: `**Deal:** ${dealName}\n**Error:** ${message}`,
    color: 15548997, // Red
  });
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    // Authenticate: accept service_role JWT OR user JWT
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return createErrorResponse(401, "Missing authorization token");
    }

    // Check if this is a service_role JWT by decoding the payload
    let isServiceRole = false;
    try {
      const payloadB64 = token.split(".")[1];
      if (payloadB64) {
        const payload = JSON.parse(atob(payloadB64));
        isServiceRole = payload.role === "service_role";
      }
    } catch {
      // Not a valid JWT format — will try user auth below
    }

    if (!isServiceRole) {
      // Verify as user JWT
      try {
        const { data: userData } = await supabaseAdmin.auth.getUser(token);
        if (!userData?.user) {
          return createErrorResponse(401, "Unauthorized");
        }
      } catch {
        return createErrorResponse(401, "Unauthorized");
      }
    }

    // Keep service role key available for internal edge function calls
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || token;

    let payload: DealPayload;
    try {
      payload = await req.json();
    } catch {
      return createErrorResponse(400, "Invalid JSON body");
    }

    const { deal_id } = payload;
    if (!deal_id) {
      return createErrorResponse(400, "Missing deal_id");
    }

    const supabase = supabaseAdmin;

    try {
      // ================================================================
      // Step 1: Fetch deal with related data
      // ================================================================
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .select(
          "*, companies(id, name, sector, description, website, address, zipcode, city, lead_score, segment, has_facebook, facebook_url, has_instagram, instagram_url, website_score, industry, phone_number)",
        )
        .eq("id", deal_id)
        .single();

      if (dealError || !deal) {
        return createErrorResponse(404, "Deal not found");
      }

      const company = (deal as any).companies;
      const dealName = deal.name || "Unnamed deal";

      // ================================================================
      // Step 2: Find primary contact for this deal/company
      // ================================================================
      let contact = null;

      // Try to find contact linked to this deal
      // Note: deals uses contact_ids (integer array), not contact_id
      const contactIds = deal.contact_ids;
      if (Array.isArray(contactIds) && contactIds.length > 0) {
        const { data } = await supabase
          .from("contacts")
          .select("*")
          .eq("id", contactIds[0])
          .single();
        contact = data;
      }

      // Fallback: find first contact linked to the company
      if (!contact && company?.id) {
        const { data } = await supabase
          .from("contacts")
          .select("*")
          .eq("company_id", company.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .single();
        contact = data;
      }

      // ================================================================
      // Step 3: VALIDATION — check required data exists
      // ================================================================
      const validationErrors: string[] = [];

      // Check contact email
      const contactEmails = contact?.email_jsonb || [];
      const primaryEmail = contactEmails[0]?.email;
      if (!primaryEmail) {
        validationErrors.push(
          "No email found for contact — add an email to the contact first",
        );
      }

      // Check that we have SOME context for the proposal
      // (meeting analysis OR at least company description)
      let hasMeetingAnalysis = false;
      let meetingAnalysis: Record<string, unknown> | null = null;

      if (contact?.id || company?.id) {
        const meetingFilter: Record<string, unknown> = {};
        if (contact?.id) meetingFilter.contact_id = contact.id;
        else if (company?.id) meetingFilter.company_id = company.id;

        const { data: transcriptions } = await supabase
          .from("meeting_transcriptions")
          .select("analysis, analyzed_at")
          .match(meetingFilter)
          .not("analysis", "is", null)
          .order("analyzed_at", { ascending: false })
          .limit(1);

        if (transcriptions?.[0]?.analysis) {
          hasMeetingAnalysis = true;
          meetingAnalysis = transcriptions[0].analysis as Record<
            string,
            unknown
          >;
        }
      }

      if (!hasMeetingAnalysis && !company?.description && !company?.industry) {
        validationErrors.push(
          "No meeting analysis and no company description — add context before generating a proposal",
        );
      }

      // If validation fails, notify Discord and stop
      if (validationErrors.length > 0) {
        const errorMsg = validationErrors.join("\n");
        await notifyDiscordError(dealName, errorMsg);

        // Revert deal stage to "opportunity" so user can fix and retry
        await supabase
          .from("deals")
          .update({ stage: "opportunity" })
          .eq("id", deal_id);

        return createErrorResponse(422, errorMsg);
      }

      // ================================================================
      // Step 4: Fetch configuration (KB template, seller company)
      // ================================================================
      const { data: configData } = await supabase
        .from("configuration")
        .select("config")
        .eq("id", 1)
        .single();

      const config = configData?.config || {};
      const seller = config.sellerCompany || {};
      const kbTemplate = config.proposalKbTemplate || "";
      const currency = config.currency || "SEK";

      // ================================================================
      // Step 5: Auto-create quote linked to the deal
      // ================================================================
      const contactName = contact
        ? `${contact.first_name} ${contact.last_name}`.trim()
        : "";

      const quoteTitle = deal.name || `Offert — ${company?.name || "Kund"}`;

      const createQuoteStartedAt = new Date();
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .insert({
          title: quoteTitle,
          company_id: company?.id || deal.company_id,
          contact_id: contact?.id || null,
          deal_id: deal_id,
          sales_id: deal.sales_id || null,
          status: "draft",
          currency: currency,
          vat_rate: 25,
          discount_percent: 0,
          payment_terms: seller.defaultPaymentTerms || "30 dagar netto",
          delivery_terms: seller.defaultDeliveryTerms || "",
          terms_and_conditions: seller.defaultTermsAndConditions || "",
          valid_until: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        })
        .select()
        .single();

      if (quoteError || !quote) {
        const msg = `Failed to create quote: ${quoteError?.message || "Unknown error"}`;
        await notifyDiscordError(dealName, msg);
        return createErrorResponse(500, msg);
      }

      // If the deal has an amount, create a default line item
      if (deal.amount && deal.amount > 0) {
        const lineItemDesc =
          deal.category && deal.category !== "other"
            ? `${deal.category.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())} — ${dealName}`
            : dealName;

        await supabase.from("quote_line_items").insert({
          quote_id: quote.id,
          description: lineItemDesc,
          quantity: 1,
          unit_price: deal.amount,
          sort_order: 0,
        });
      }

      try {
        const completedAt = new Date();
        await supabase.from("quote_pipeline_steps").insert({
          quote_id: quote.id,
          step_name: PIPELINE_STEP.CREATE_QUOTE,
          status: "success",
          started_at: createQuoteStartedAt.toISOString(),
          completed_at: completedAt.toISOString(),
          duration_ms: completedAt.getTime() - createQuoteStartedAt.getTime(),
          metadata: { trigger: "orchestrated", deal_id },
        });
      } catch (pipelineInsertError) {
        console.warn(
          "orchestrate_proposal: failed to log create_quote step",
          pipelineInsertError,
        );
      }

      // ================================================================
      // Step 6: Generate AI text (inline — same logic as generate_quote_text)
      // ================================================================
      const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicApiKey) {
        await notifyDiscordError(dealName, "ANTHROPIC_API_KEY not configured");
        return createErrorResponse(500, "ANTHROPIC_API_KEY not configured");
      }

      // Re-fetch line items (the trigger might have updated totals)
      const { data: lineItems } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", quote.id)
        .order("sort_order", { ascending: true });

      const enrichmentContext = buildEnrichmentContext(company);
      const meetingContext = buildMeetingContext(meetingAnalysis);

      const recentCallLogs = await fetchRecentCallLogs(supabase, {
        contactId: contact?.id,
        companyId: company?.id,
      });
      const callLogsContext = buildCallLogsContext(recentCallLogs);

      // Build email context
      let emailContext = "";
      if (contact?.id) {
        const { data: recentEmails } = await supabase
          .from("email_sends")
          .select("subject, status, sent_at")
          .eq("contact_id", contact.id)
          .order("created_at", { ascending: false })
          .limit(3);

        if (recentEmails) {
          emailContext = buildEmailContext(recentEmails);
        }
      }

      const lineItemsText = (lineItems || [])
        .map(
          (item: {
            description: string;
            quantity: number;
            unit_price: number;
          }) =>
            `- ${item.description}: ${item.quantity} x ${item.unit_price} ${currency} = ${item.quantity * item.unit_price} ${currency}`,
        )
        .join("\n");

      // Determine if this is a web project
      const isWebProject =
        deal.category?.includes("webb") ||
        quoteTitle?.toLowerCase().includes("hemsida") ||
        quoteTitle?.toLowerCase().includes("webbplats") ||
        quoteTitle?.toLowerCase().includes("e-handel") ||
        quoteTitle?.toLowerCase().includes("shopify") ||
        company?.sector?.toLowerCase().includes("web");

      const { prompt, systemPrompt } = buildQuoteGenerationPrompts({
        companyName: company?.name || "Okänt företag",
        contactName: contactName || "kunden",
        sector: company?.sector,
        industry: company?.industry,
        companyDescription: company?.description,
        enrichmentContext,
        quoteTitle,
        isWebProject,
        lineItemsText,
        meetingContext,
        callLogsContext,
        emailContext,
        kbTemplate,
      });

      // Delegate Anthropic API call + regex parse to shared workflow helper.
      // Phase 1: single source of truth for AI response handling.
      // Phase 3: pass the validation hook so AI output that fails the
      // Zod shape check lands in quote_validation_failures instead of
      // silently being saved. On quarantine, generateSections nulls out
      // sections and downstream normalizeSections keeps production on
      // the legacy template path until the prompt/model is fixed.
      let sectionResult;
      try {
        sectionResult = await withPipelineStep(
          {
            supabase,
            quoteId: quote.id,
            stepName: PIPELINE_STEP.GENERATE_TEXT,
            metadata: { trigger: "orchestrated", deal_id },
          },
          () =>
            generateSections({
              prompt,
              systemPrompt,
              apiKey: anthropicApiKey,
              validation: {
                supabase,
                quoteId: quote.id,
                notifyDiscord: async (summary) => {
                  await notifyDiscordError(
                    dealName,
                    `AI output failed validation: ${summary.validationError}`,
                  );
                },
              },
            }),
        );
      } catch (_aiError) {
        await notifyDiscordError(dealName, "AI text generation failed");
        return createErrorResponse(502, "Failed to generate text from AI");
      }

      const generatedText = sectionResult.generatedText;
      const generatedSections = sectionResult.generatedSections;

      // Determine if quote is for a multi-page website (hide upgrade upsell)
      const isMultiPage =
        deal.category?.toLowerCase().includes("fler") ||
        quoteTitle?.toLowerCase().includes("flersidig") ||
        quoteTitle?.toLowerCase().includes("multi") ||
        deal.category === "webb-med-support";

      // Apply default content to any missing AI-generated sections.
      const enrichedSections = await withPipelineStep(
        {
          supabase,
          quoteId: quote.id,
          stepName: PIPELINE_STEP.NORMALIZE_SECTIONS,
        },
        async () =>
          enrichSectionsForOrchestration(generatedSections, {
            isMultiPage,
            recurringAmount: deal.recurring_amount,
            recurringInterval: deal.recurring_interval,
          }),
      );

      // Update quote with both structured and plain text
      const quoteUpdateData: Record<string, unknown> = {
        generated_text: generatedText,
        status: QUOTE_STATUS.GENERATED,
      };
      if (enrichedSections) {
        quoteUpdateData.generated_sections = enrichedSections;
      }

      await supabase.from("quotes").update(quoteUpdateData).eq("id", quote.id);

      // ================================================================
      // Step 7: Call generate_quote_pdf edge function
      // ================================================================
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const pdfResponse = await withPipelineStep(
        {
          supabase,
          quoteId: quote.id,
          stepName: PIPELINE_STEP.GENERATE_PDF,
          metadata: { trigger: "orchestrated", deal_id },
        },
        () =>
          fetch(
            `${supabaseUrl}/functions/v1/generate_quote_pdf`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({ quote_id: quote.id }),
            },
          ),
      );

      let pdfUrl = "";
      if (pdfResponse.ok) {
        const pdfResult = await pdfResponse.json();
        pdfUrl = pdfResult.pdf_url || "";
      } else {
        console.error("PDF generation failed:", await pdfResponse.text());
        // Continue anyway — we can still post to Discord without PDF
      }

      // ================================================================
      // Step 8: Post to Discord for review
      // ================================================================
      const { data: updatedQuote } = await supabase
        .from("quotes")
        .select("quote_number")
        .eq("id", quote.id)
        .single();

      const quoteNumber = updatedQuote?.quote_number || `#${quote.id}`;
      const crmUrl =
        Deno.env.get("CRM_PUBLIC_URL") ||
        Deno.env.get("ALLOWED_ORIGIN") ||
        "http://localhost:5173";

      const totalAmount = deal.amount
        ? `${Number(deal.amount).toLocaleString("sv-SE")} ${currency}`
        : "Ej angivet";

      const previewUrl = `${crmUrl}/quote.html?id=${quote.id}&token=${quote.approval_token}`;

      // Build Discord link buttons
      const discordButtons: Array<{
        label: string;
        url: string;
        emoji?: string;
      }> = [];
      if (pdfUrl) {
        discordButtons.push({
          label: "Forhandsgranska",
          url: previewUrl,
        });
      }
      discordButtons.push({
        label: "Granska och skicka i CRM",
        url: `${crmUrl}/#/quotes/${quote.id}/show`,
      });

      await withPipelineStep(
        {
          supabase,
          quoteId: quote.id,
          stepName: PIPELINE_STEP.DISCORD_NOTIFY,
          metadata: { trigger: "orchestrated", deal_id },
        },
        () =>
          notifyDiscord(
            {
              title: "Ny offert redo for granskning",
              description: [
                `**Deal:** ${dealName}`,
                `**Foretag:** ${company?.name || "Okant"}`,
                `**Kontakt:** ${contactName || "Ingen kontakt"} (${primaryEmail})`,
                `**Belopp:** ${totalAmount}`,
                `**Offert:** ${quoteNumber}`,
              ].join("\n"),
              color: 3447003, // Blue
              fields: [
                {
                  name: "AI-genererad text (forsta 200 tecken)",
                  value:
                    generatedText.substring(0, 200) +
                    (generatedText.length > 200 ? "..." : ""),
                },
              ],
            },
            discordButtons,
          ),
      );

      return new Response(
        JSON.stringify({
          success: true,
          quote_id: quote.id,
          quote_number: quoteNumber,
          pdf_url: pdfUrl,
          review_url: `${crmUrl}/#/quotes/${quote.id}/show`,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (error) {
      console.error("orchestrate_proposal error:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      await notifyDiscordError(payload.deal_name || `Deal #${deal_id}`, msg);
      return createErrorResponse(500, `Proposal orchestration failed: ${msg}`);
    }
  }),
);
