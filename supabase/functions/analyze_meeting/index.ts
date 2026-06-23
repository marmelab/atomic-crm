import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse, createJsonResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  errorResponseFromUnknown,
  getPositiveIntegerField,
  getOptionalStringField,
  parseRequiredJsonBody,
} from "../_shared/http.ts";

/**
 * Analyze Meeting Edge Function
 *
 * Takes a meeting transcription (manual paste or existing record),
 * analyzes via Claude API, and extracts:
 * - Summary
 * - Customer needs
 * - Objections/concerns
 * - Action items (auto-creates tasks)
 * - Quote context (for future quote generation)
 */

interface AnalysisResult {
  summary: string;
  customer_needs: string[];
  objections: string[];
  action_items: Array<{
    text: string;
    assignee: string;
    due_days: number;
  }>;
  quote_context: {
    services_discussed: string[];
    budget_mentioned: string | null;
    timeline: string | null;
    decision_makers: string[];
    next_steps: string;
  };
  sentiment: "positive" | "neutral" | "negative";
  deal_probability: number;
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }

        try {
          const body = await parseRequiredJsonBody(req);
          const transcription_id = getPositiveIntegerField(
            body,
            "transcription_id",
          );
          const transcription_text = getOptionalStringField(
            body,
            "transcription_text",
          );
          const calendar_event_id = getPositiveIntegerField(
            body,
            "calendar_event_id",
          );
          const contact_id = getPositiveIntegerField(body, "contact_id");
          const company_id = getPositiveIntegerField(body, "company_id");

          const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
          if (!anthropicApiKey) {
            return createErrorResponse(500, "ANTHROPIC_API_KEY not configured");
          }

          let transcription = transcription_text;
          let transcriptionRecord = null;

          // If transcription_id provided, fetch existing
          if (transcription_id) {
            const { data, error } = await supabaseAdmin
              .from("meeting_transcriptions")
              .select("*")
              .eq("id", transcription_id)
              .single();

            if (error || !data) {
              return createErrorResponse(404, "Transcription not found");
            }
            transcriptionRecord = data;
            transcription = data.transcription_text;
          }

          if (!transcription || transcription.trim().length < 50) {
            return createErrorResponse(
              400,
              "Transcription text is too short (min 50 characters)",
            );
          }

          // If no existing record, create one
          if (!transcriptionRecord) {
            const { data: newRecord, error: insertErr } = await supabaseAdmin
              .from("meeting_transcriptions")
              .insert({
                calendar_event_id: calendar_event_id || null,
                contact_id: contact_id || null,
                company_id: company_id || null,
                transcription_text: transcription,
                transcription_source: "manual",
              })
              .select()
              .single();

            if (insertErr || !newRecord) {
              console.error("Insert transcription error:", insertErr);
              return createErrorResponse(500, "Failed to save transcription");
            }
            transcriptionRecord = newRecord;
          }

          // Fetch context: company + contact
          let companyContext = "";
          const effectiveCompanyId =
            company_id || transcriptionRecord.company_id;
          if (effectiveCompanyId) {
            const { data: company } = await supabaseAdmin
              .from("companies")
              .select(
                "name, sector, website, description, lead_score, segment, enrichment_data",
              )
              .eq("id", effectiveCompanyId)
              .single();
            if (company) {
              companyContext = `\nFöretag: ${company.name}${company.sector ? ` (${company.sector})` : ""}${company.website ? `\nHemsida: ${company.website}` : ""}${company.description ? `\nBeskrivning: ${company.description}` : ""}${company.lead_score ? `\nLead score: ${company.lead_score}/100` : ""}${company.segment ? `\nSegment: ${company.segment}` : ""}`;
            }
          }

          let contactContext = "";
          const effectiveContactId =
            contact_id || transcriptionRecord.contact_id;
          if (effectiveContactId) {
            const { data: contact } = await supabaseAdmin
              .from("contacts")
              .select("first_name, last_name, title")
              .eq("id", effectiveContactId)
              .single();
            if (contact) {
              contactContext = `\nKontakt: ${contact.first_name} ${contact.last_name}${contact.title ? ` (${contact.title})` : ""}`;
            }
          }

          // Claude API analysis
          const prompt = `Analysera denna mötesanteckning/transkribering och returnera resultatet som JSON.
${companyContext}${contactContext}

TRANSKRIBERING:
---
${transcription}
---

Returnera EXAKT denna JSON-struktur (inget annat):
{
  "summary": "2-4 meningar som sammanfattar mötet",
  "customer_needs": ["behov 1", "behov 2"],
  "objections": ["invändning 1", "invändning 2"],
  "action_items": [
    {"text": "vad som ska göras", "assignee": "oss/kunden", "due_days": 3}
  ],
  "quote_context": {
    "services_discussed": ["tjänst 1", "tjänst 2"],
    "budget_mentioned": "summa eller null",
    "timeline": "tidsram eller null",
    "decision_makers": ["namn"],
    "next_steps": "konkret nästa steg"
  },
  "sentiment": "positive/neutral/negative",
  "deal_probability": 0-100
}

Regler:
- Allt på svenska
- Var konkret och specifik, inga generiska svar
- Om information saknas, sätt null eller tom array
- deal_probability baseras på sentiment, behov, invändningar och timeline`;

          const response = await fetch(
            "https://api.anthropic.com/v1/messages",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicApiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-6",
                max_tokens: 4000,
                messages: [{ role: "user", content: prompt }],
                system:
                  "Du är en erfaren säljanalytiker på Axona Digital AB, en webb- och AI-byrå. Du analyserar kundmöten för att identifiera säljmöjligheter och nästa steg. Returnera alltid valid JSON.",
              }),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Claude API error:", errorText);
            return createErrorResponse(502, "AI analysis failed");
          }

          const result = await response.json();
          const analysisText = result.content?.[0]?.text || "";

          // Parse JSON from response (handle markdown code blocks)
          let analysis: AnalysisResult;
          try {
            const jsonStr = analysisText
              .replace(/```json\n?/g, "")
              .replace(/```\n?/g, "")
              .trim();
            analysis = JSON.parse(jsonStr);
          } catch {
            console.error("Failed to parse analysis JSON:", analysisText);
            return createErrorResponse(
              500,
              "Failed to parse AI analysis result",
            );
          }

          // Update transcription record with analysis
          await supabaseAdmin
            .from("meeting_transcriptions")
            .update({
              analysis,
              analyzed_at: new Date().toISOString(),
            })
            .eq("id", transcriptionRecord.id);

          // Auto-create tasks from action items
          const createdTasks: number[] = [];
          if (analysis.action_items?.length > 0) {
            // Get sales_id for task assignment
            let salesId = null;
            if (user) {
              const { data: sale } = await supabaseAdmin
                .from("sales")
                .select("id")
                .eq("user_id", user.id)
                .single();
              salesId = sale?.id;
            }

            for (const item of analysis.action_items) {
              if (item.assignee === "oss" || item.assignee === "vi") {
                const { data: task } = await supabaseAdmin
                  .from("tasks")
                  .insert({
                    contact_id: effectiveContactId || null,
                    text: item.text,
                    type: "Meeting",
                    due_date: new Date(
                      Date.now() + (item.due_days || 3) * 86400000,
                    ).toISOString(),
                    done_date: null,
                    sales_id: salesId,
                  })
                  .select("id")
                  .single();

                if (task) createdTasks.push(task.id);
              }
            }
          }

          return createJsonResponse({
            transcription_id: transcriptionRecord.id,
            analysis,
            tasks_created: createdTasks.length,
            task_ids: createdTasks,
          });
        } catch (error) {
          console.error("analyze_meeting error:", error);
          return errorResponseFromUnknown(error);
        }
      }),
    ),
  ),
);
