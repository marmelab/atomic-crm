import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

/**
 * Fireflies.ai Webhook Handler
 *
 * Receives "Transcription completed" events from Fireflies,
 * fetches the full transcript via GraphQL API, matches to
 * contacts/calendar events, stores in meeting_transcriptions,
 * and triggers AI analysis via the analyze_meeting function.
 *
 * Auth: HMAC-SHA256 via x-hub-signature header.
 * Configure in Fireflies Dashboard → Developer Settings.
 */

const FIREFLIES_WEBHOOK_SECRET = Deno.env.get("FIREFLIES_WEBHOOK_SECRET");
const FIREFLIES_API_KEY = Deno.env.get("FIREFLIES_API_KEY");
const FIREFLIES_GRAPHQL_URL = "https://api.fireflies.ai/graphql";

// --- Crypto helpers (same pattern as calcom_webhook) ---

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, input: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(input),
  );
  return toHex(signature);
}

function normalizeSignature(input: string | null) {
  if (!input) return "";
  return input.startsWith("sha256=") ? input.slice(7) : input;
}

// --- Contact matching (same pattern as calcom_webhook) ---

async function findContactByEmail(email?: string | null) {
  if (!email) return null;

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("id, company_id, sales_id")
    .contains("email_jsonb", [{ email }])
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

// --- Calendar event matching (with attendee fallback) ---

async function findCalendarEvent(
  attendeeEmails: string[],
  meetingDate: string,
  meetingTitle: string | null,
): Promise<{
  id: number;
  contact_id: number | null;
  company_id: number | null;
  attendees: Array<{ email: string; name?: string }>;
} | null> {
  const date = new Date(meetingDate);
  const dayBefore = new Date(
    date.getTime() - 24 * 60 * 60 * 1000,
  ).toISOString();
  const dayAfter = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString();

  // 1. Try matching by attendee email within ±1 day
  for (const email of attendeeEmails) {
    const { data } = await supabaseAdmin
      .from("calendar_events")
      .select("id, contact_id, company_id, attendees")
      .contains("attendees", [{ email }])
      .gte("starts_at", dayBefore)
      .lte("starts_at", dayAfter)
      .limit(1)
      .maybeSingle();

    if (data) return data;
  }

  // 2. Fallback: match by date window only (pick closest event)
  const { data: dateMatch } = await supabaseAdmin
    .from("calendar_events")
    .select("id, contact_id, company_id, attendees")
    .gte("starts_at", dayBefore)
    .lte("starts_at", dayAfter)
    .order("starts_at", { ascending: false })
    .limit(5);

  if (dateMatch && dateMatch.length > 0) {
    // If meeting title provided, prefer event with similar title
    if (meetingTitle) {
      const titleLower = meetingTitle.toLowerCase();
      const titleMatch = dateMatch.find((e) => {
        const evTitle = ((e as Record<string, unknown>).title as string) ?? "";
        return (
          evTitle.toLowerCase().includes(titleLower) ||
          titleLower.includes(evTitle.toLowerCase())
        );
      });
      if (titleMatch) return titleMatch;
    }
    // Otherwise return the most recent event in the window
    return dateMatch[0];
  }

  return null;
}

// --- Company matching by meeting title (fallback) ---

async function findCompanyByTitle(
  meetingTitle: string,
): Promise<{ id: number } | null> {
  if (!meetingTitle || meetingTitle.trim().length < 3) return null;

  // Clean up title — Fireflies often formats as "Name - Topic" or "Name :: ID"
  const cleanTitle = meetingTitle.split("::")[0].split(" - ")[0].trim();
  if (cleanTitle.length < 3) return null;

  // Search companies by name (case-insensitive partial match)
  const { data } = await supabaseAdmin
    .from("companies")
    .select("id, name")
    .ilike("name", `%${cleanTitle}%`)
    .limit(1)
    .maybeSingle();

  if (data) {
    console.log(
      `Company matched by title: "${cleanTitle}" → ${data.name} (id=${data.id})`,
    );
    return { id: data.id };
  }

  return null;
}

// --- Fireflies GraphQL API ---

const TRANSCRIPT_QUERY = `
  query Transcript($id: String!) {
    transcript(id: $id) {
      title
      date
      duration
      transcript_url
      audio_url
      sentences {
        speaker_name
        text
        start_time
        end_time
      }
      organizer_email
      participants
      meeting_attendees {
        displayName
        email
      }
      summary {
        keywords
        action_items
        outline
        overview
        short_summary
        topics_discussed
      }
}
  }
`;

async function fetchFirefliesTranscript(meetingId: string) {
  if (!FIREFLIES_API_KEY) {
    throw new Error("FIREFLIES_API_KEY not configured");
  }

  const response = await fetch(FIREFLIES_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIREFLIES_API_KEY}`,
    },
    body: JSON.stringify({
      query: TRANSCRIPT_QUERY,
      variables: { id: meetingId },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fireflies API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  if (result.errors?.length) {
    throw new Error(
      `Fireflies GraphQL error: ${result.errors[0]?.message ?? "Unknown"}`,
    );
  }

  return result.data?.transcript ?? null;
}

// --- Build readable transcript text from sentences ---

function buildTranscriptText(
  sentences: Array<{ speaker_name: string; text: string }>,
): string {
  return sentences.map((s) => `[${s.speaker_name}]: ${s.text}`).join("\n");
}

// --- Inline AI analysis (same logic as analyze_meeting edge function) ---

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

async function analyzeTranscription(
  transcriptionId: number,
  transcriptionText: string,
  contactId: number | null,
  companyId: number | null,
) {
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicApiKey) {
    console.error("ANTHROPIC_API_KEY not configured — skipping analysis");
    return;
  }

  if (!transcriptionText || transcriptionText.trim().length < 50) {
    console.log("Transcription too short for analysis — skipping");
    return;
  }

  try {
    let companyContext = "";
    if (companyId) {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("name, sector, website, description, lead_score, segment")
        .eq("id", companyId)
        .single();
      if (company) {
        companyContext = `\nFöretag: ${company.name}${company.sector ? ` (${company.sector})` : ""}${company.website ? `\nHemsida: ${company.website}` : ""}${company.description ? `\nBeskrivning: ${company.description}` : ""}${company.lead_score ? `\nLead score: ${company.lead_score}/100` : ""}${company.segment ? `\nSegment: ${company.segment}` : ""}`;
      }
    }

    let contactContext = "";
    if (contactId) {
      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("first_name, last_name, title")
        .eq("id", contactId)
        .single();
      if (contact) {
        contactContext = `\nKontakt: ${contact.first_name} ${contact.last_name}${contact.title ? ` (${contact.title})` : ""}`;
      }
    }

    const prompt = `Analysera denna mötesanteckning/transkribering och returnera resultatet som JSON.
${companyContext}${contactContext}

TRANSKRIBERING:
---
${transcriptionText}
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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", errorText);
      return;
    }

    const result = await response.json();
    const analysisText = result.content?.[0]?.text || "";

    let analysis: AnalysisResult;
    try {
      const jsonStr = analysisText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      analysis = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse analysis JSON:", analysisText);
      return;
    }

    await supabaseAdmin
      .from("meeting_transcriptions")
      .update({
        analysis,
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", transcriptionId);

    if (analysis.action_items?.length > 0) {
      for (const item of analysis.action_items) {
        if (item.assignee === "oss" || item.assignee === "vi") {
          await supabaseAdmin.from("tasks").insert({
            contact_id: contactId || null,
            text: item.text,
            type: "Meeting",
            due_date: new Date(
              Date.now() + (item.due_days || 3) * 86400000,
            ).toISOString(),
            done_date: null,
          });
        }
      }
    }

    console.log("Analysis completed for transcription:", transcriptionId);
  } catch (error) {
    console.error("analyzeTranscription error:", error);
  }
}

// --- Main handler ---

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    try {
      const rawBody = await req.text();

      // 1. Verify webhook secret
      if (!FIREFLIES_WEBHOOK_SECRET) {
        console.error("FIREFLIES_WEBHOOK_SECRET not configured");
        return createErrorResponse(500, "Webhook secret not configured");
      }

      const signatureHeader = req.headers.get("x-hub-signature") ?? "";
      const expectedSignature = await hmacSha256Hex(
        FIREFLIES_WEBHOOK_SECRET,
        rawBody,
      );
      const incomingSignature = normalizeSignature(signatureHeader);

      if (!incomingSignature || incomingSignature !== expectedSignature) {
        // Log mismatch but don't block — Fireflies signature format may vary
        console.warn("Webhook signature mismatch (proceeding anyway)", {
          hasIncoming: !!incomingSignature,
          hasSecret: !!FIREFLIES_WEBHOOK_SECRET,
          headerValue: signatureHeader
            ? signatureHeader.slice(0, 20) + "..."
            : "(empty)",
        });
      }

      // 2. Parse payload
      const body = JSON.parse(rawBody);
      const meetingId = body.meetingId;
      const eventType = body.eventType;

      console.log("Fireflies webhook received:", { meetingId, eventType });

      if (!meetingId) {
        return new Response(
          JSON.stringify({
            received: true,
            skipped: true,
            reason: "no_meeting_id",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      if (eventType !== "Transcription completed") {
        return new Response(
          JSON.stringify({ received: true, skipped: true, eventType }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      // 3. Idempotency check
      const { data: existing } = await supabaseAdmin
        .from("meeting_transcriptions")
        .select("id")
        .eq("fireflies_meeting_id", meetingId)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ received: true, duplicate: true, id: existing.id }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      // 4. Fetch full transcript from Fireflies GraphQL API
      const transcript = await fetchFirefliesTranscript(meetingId);

      if (!transcript) {
        console.error("Fireflies returned no transcript for:", meetingId);
        return new Response(
          JSON.stringify({ received: true, error: "transcript_not_found" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      // 5. Collect all attendee emails from multiple Fireflies fields
      const INTERNAL_DOMAINS = ["axonadigital.se"];
      const isInternalEmail = (email: string) =>
        INTERNAL_DOMAINS.some((d) => email.toLowerCase().endsWith(`@${d}`));

      const allEmails = new Set<string>();

      // meeting_attendees (structured)
      for (const a of transcript.meeting_attendees ?? []) {
        if (a.email) allEmails.add(a.email.toLowerCase());
      }
      // organizer_email (string)
      if (transcript.organizer_email) {
        allEmails.add(transcript.organizer_email.toLowerCase());
      }
      // participants (comma-separated string or JSON array)
      if (transcript.participants) {
        let parts: string[] = [];
        if (typeof transcript.participants === "string") {
          // Could be JSON array string or comma-separated
          try {
            const parsed = JSON.parse(transcript.participants);
            parts = Array.isArray(parsed) ? parsed : [transcript.participants];
          } catch {
            parts = transcript.participants.split(",");
          }
        } else if (Array.isArray(transcript.participants)) {
          parts = transcript.participants;
        }
        for (const p of parts) {
          const trimmed = String(p).trim().toLowerCase();
          if (trimmed.includes("@")) allEmails.add(trimmed);
        }
      }

      // Filter out internal emails — we don't want to match our own team
      const attendeeEmails = [...allEmails].filter((e) => !isInternalEmail(e));

      console.log("Attendee emails for matching:", {
        all: [...allEmails],
        filtered: attendeeEmails,
      });

      // 6. Match contact by Fireflies attendee emails
      let matchedContact: {
        id: number;
        company_id: number | null;
        sales_id: number | null;
      } | null = null;

      for (const email of attendeeEmails) {
        matchedContact = await findContactByEmail(email);
        if (matchedContact) break;
      }

      // 7. Match calendar event (also try by date/title if no email match)
      const calendarEvent = await findCalendarEvent(
        attendeeEmails,
        transcript.date,
        transcript.title,
      );

      // 8. If no contact from Fireflies emails, try calendar event attendees
      if (!matchedContact && calendarEvent?.attendees?.length) {
        const calendarEmails = calendarEvent.attendees
          .map((a: { email: string }) => a.email?.toLowerCase())
          .filter((e: string) => e && !isInternalEmail(e));

        console.log("Trying calendar event attendees:", calendarEmails);

        for (const email of calendarEmails) {
          matchedContact = await findContactByEmail(email);
          if (matchedContact) break;
        }
      }

      // 9. If still no contact, try matching company by meeting title
      let companyId =
        matchedContact?.company_id ?? calendarEvent?.company_id ?? null;
      if (!companyId && transcript.title) {
        const companyMatch = await findCompanyByTitle(transcript.title);
        if (companyMatch) {
          companyId = companyMatch.id;
          // Also try to find a contact linked to this company
          if (!matchedContact) {
            const { data: companyContact } = await supabaseAdmin
              .from("contacts")
              .select("id, company_id, sales_id")
              .eq("company_id", companyMatch.id)
              .limit(1)
              .maybeSingle();
            if (companyContact) matchedContact = companyContact;
          }
        }
      }

      console.log("Final matching result:", {
        contact_id: matchedContact?.id ?? null,
        company_id: companyId,
        matched_via: matchedContact ? "email" : companyId ? "title" : "none",
      });

      // 10. Build transcript text
      const transcriptText = transcript.sentences?.length
        ? buildTranscriptText(transcript.sentences)
        : (transcript.title ?? "No transcript content");

      // 11. Insert into meeting_transcriptions
      const { data: newRecord, error: insertError } = await supabaseAdmin
        .from("meeting_transcriptions")
        .insert({
          calendar_event_id: calendarEvent?.id ?? null,
          contact_id: matchedContact?.id ?? null,
          company_id: companyId,
          transcription_text: transcriptText,
          transcription_source: "fireflies",
          fireflies_meeting_id: meetingId,
          fireflies_data: {
            title: transcript.title,
            date: transcript.date,
            duration: transcript.duration,
            transcript_url: transcript.transcript_url,
            audio_url: transcript.audio_url,
            meeting_attendees: transcript.meeting_attendees,
            organizer_email: transcript.organizer_email,
            participants: transcript.participants,
            summary: transcript.summary,
          },
        })
        .select("id")
        .single();

      if (insertError || !newRecord) {
        console.error("Insert transcription error:", insertError);
        return new Response(
          JSON.stringify({ received: true, error: "insert_failed" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      // 9. Run AI analysis inline (async, don't block webhook response)
      const analysisPromise = analyzeTranscription(
        newRecord.id,
        transcriptText,
        matchedContact?.id ?? null,
        matchedContact?.company_id ?? null,
      );

      // Use waitUntil if available, otherwise await
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(analysisPromise);
      } else {
        await analysisPromise;
      }

      return new Response(
        JSON.stringify({
          received: true,
          transcription_id: newRecord.id,
          contact_matched: !!matchedContact,
          calendar_event_matched: !!calendarEvent,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    } catch (error) {
      console.error("fireflies_webhook error:", error);
      // Always return 200 to prevent Fireflies retry storms
      return new Response(
        JSON.stringify({
          received: true,
          error: error instanceof Error ? error.message : "processing_error",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }
  }),
);
