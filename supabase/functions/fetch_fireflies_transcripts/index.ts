import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

/**
 * Fetch Fireflies Transcripts for a Contact
 *
 * Searches the Fireflies GraphQL API for transcripts matching a contact's
 * email, name, or company name. Returns matches for the user to select
 * and import into meeting_transcriptions.
 *
 * Accepts POST with:
 *   - contact_id (required): The contact to search for
 *   - import_meeting_id (optional): If provided, imports that specific transcript
 */

const FIREFLIES_API_KEY = Deno.env.get("FIREFLIES_API_KEY");
const FIREFLIES_GRAPHQL_URL = "https://api.fireflies.ai/graphql";

// --- Fireflies GraphQL queries ---

const SEARCH_TRANSCRIPTS_QUERY = `
  query Transcripts($limit: Int, $skip: Int) {
    transcripts(limit: $limit, skip: $skip) {
      id
      title
      date
      duration
      transcript_url
      organizer_email
      participants
      meeting_attendees {
        displayName
        email
      }
      summary {
        overview
        short_summary
      }
    }
  }
`;

const FULL_TRANSCRIPT_QUERY = `
  query Transcript($id: String!) {
    transcript(id: $id) {
      id
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

interface FirefliesTranscript {
  id: string;
  title: string | null;
  date: string | null;
  duration: number | null;
  transcript_url: string | null;
  organizer_email: string | null;
  participants: string | string[] | null;
  meeting_attendees: Array<{ displayName: string; email: string }> | null;
  summary: {
    overview: string | null;
    short_summary: string | null;
  } | null;
}

async function firefliesQuery(
  query: string,
  variables: Record<string, unknown>,
) {
  if (!FIREFLIES_API_KEY) {
    throw new Error("FIREFLIES_API_KEY not configured");
  }

  const response = await fetch(FIREFLIES_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIREFLIES_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
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

  return result.data;
}

// --- Contact data fetching ---

interface ContactData {
  id: number;
  first_name: string | null;
  last_name: string | null;
  emails: string[];
  company_name: string | null;
}

async function getContactData(contactId: number): Promise<ContactData | null> {
  const { data: contact, error } = await supabaseAdmin
    .from("contacts")
    .select("id, first_name, last_name, email_jsonb, company_id")
    .eq("id", contactId)
    .single();

  if (error || !contact) return null;

  const emails: string[] = [];
  if (Array.isArray(contact.email_jsonb)) {
    for (const entry of contact.email_jsonb) {
      if (entry?.email) emails.push(entry.email.toLowerCase());
    }
  }

  let companyName: string | null = null;
  if (contact.company_id) {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name")
      .eq("id", contact.company_id)
      .single();
    if (company) companyName = company.name;
  }

  return {
    id: contact.id,
    first_name: contact.first_name,
    last_name: contact.last_name,
    emails,
    company_name: companyName,
  };
}

// --- Matching logic ---

function collectEmails(transcript: FirefliesTranscript): string[] {
  const emails = new Set<string>();

  for (const a of transcript.meeting_attendees ?? []) {
    if (a.email) emails.add(a.email.toLowerCase());
  }
  if (transcript.organizer_email) {
    emails.add(transcript.organizer_email.toLowerCase());
  }
  if (transcript.participants) {
    let parts: string[] = [];
    if (typeof transcript.participants === "string") {
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
      if (trimmed.includes("@")) emails.add(trimmed);
    }
  }

  return [...emails];
}

function matchesContact(
  transcript: FirefliesTranscript,
  contact: ContactData,
): { matched: boolean; match_type: string } {
  const transcriptEmails = collectEmails(transcript);

  // 1. Email match (strongest signal)
  for (const contactEmail of contact.emails) {
    if (transcriptEmails.includes(contactEmail)) {
      return { matched: true, match_type: "email" };
    }
  }

  // 2. Name match in attendees
  const fullName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (fullName.length >= 3) {
    for (const a of transcript.meeting_attendees ?? []) {
      if (a.displayName?.toLowerCase().includes(fullName)) {
        return { matched: true, match_type: "name" };
      }
    }

    // Check title for name
    if (transcript.title?.toLowerCase().includes(fullName)) {
      return { matched: true, match_type: "name_in_title" };
    }
  }

  // 3. Company name match in title
  if (contact.company_name && contact.company_name.length >= 3) {
    const companyLower = contact.company_name.toLowerCase();
    if (transcript.title?.toLowerCase().includes(companyLower)) {
      return { matched: true, match_type: "company" };
    }
  }

  return { matched: false, match_type: "none" };
}

// --- Import logic (reuses patterns from fireflies_webhook) ---

function buildTranscriptText(
  sentences: Array<{ speaker_name: string; text: string }>,
): string {
  return sentences.map((s) => `[${s.speaker_name}]: ${s.text}`).join("\n");
}

async function importTranscript(
  meetingId: string,
  contactId: number,
  companyId: number | null,
) {
  // Check idempotency
  const { data: existing } = await supabaseAdmin
    .from("meeting_transcriptions")
    .select("id, contact_id")
    .eq("fireflies_meeting_id", meetingId)
    .maybeSingle();

  if (existing) {
    // If it exists but has no contact_id, update it
    if (!existing.contact_id) {
      await supabaseAdmin
        .from("meeting_transcriptions")
        .update({ contact_id: contactId, company_id: companyId })
        .eq("id", existing.id);

      return { imported: true, transcription_id: existing.id, updated: true };
    }
    return {
      imported: false,
      transcription_id: existing.id,
      already_exists: true,
    };
  }

  // Fetch full transcript
  const data = await firefliesQuery(FULL_TRANSCRIPT_QUERY, { id: meetingId });
  const transcript = data?.transcript;

  if (!transcript) {
    throw new Error("Could not fetch transcript from Fireflies");
  }

  const transcriptText = transcript.sentences?.length
    ? buildTranscriptText(transcript.sentences)
    : (transcript.summary?.overview ??
      transcript.title ??
      "No transcript content");

  const { data: newRecord, error: insertError } = await supabaseAdmin
    .from("meeting_transcriptions")
    .insert({
      contact_id: contactId,
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
    throw new Error(`Failed to insert transcription: ${insertError?.message}`);
  }

  // Trigger AI analysis (inline, same as fireflies_webhook)
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicApiKey && transcriptText.trim().length >= 50) {
    // Fire and forget — don't block the response
    analyzeInBackground(newRecord.id, transcriptText, contactId, companyId);
  }

  return { imported: true, transcription_id: newRecord.id, updated: false };
}

async function analyzeInBackground(
  transcriptionId: number,
  transcriptionText: string,
  contactId: number,
  companyId: number | null,
) {
  try {
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) return;

    let companyContext = "";
    if (companyId) {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("name, sector, website, description")
        .eq("id", companyId)
        .single();
      if (company) {
        companyContext = `\nForetag: ${company.name}${company.sector ? ` (${company.sector})` : ""}`;
      }
    }

    let contactContext = "";
    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("first_name, last_name, title")
      .eq("id", contactId)
      .single();
    if (contact) {
      contactContext = `\nKontakt: ${contact.first_name} ${contact.last_name}${contact.title ? ` (${contact.title})` : ""}`;
    }

    const prompt = `Analysera denna motesanteckning/transkribering och returnera resultatet som JSON.
${companyContext}${contactContext}

TRANSKRIBERING:
---
${transcriptionText}
---

Returnera EXAKT denna JSON-struktur (inget annat):
{
  "summary": "2-4 meningar som sammanfattar motet",
  "customer_needs": ["behov 1", "behov 2"],
  "objections": ["invandning 1", "invandning 2"],
  "action_items": [
    {"text": "vad som ska goras", "assignee": "oss/kunden", "due_days": 3}
  ],
  "quote_context": {
    "services_discussed": ["tjanst 1", "tjanst 2"],
    "budget_mentioned": "summa eller null",
    "timeline": "tidsram eller null",
    "decision_makers": ["namn"],
    "next_steps": "konkret nasta steg"
  },
  "sentiment": "positive/neutral/negative",
  "deal_probability": 0-100
}

Regler:
- Allt pa svenska
- Var konkret och specifik, inga generiska svar
- Om information saknas, satt null eller tom array
- deal_probability baseras pa sentiment, behov, invandningar och timeline`;

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
          "Du ar en erfaren saljanalytiker pa Axona Digital AB, en webb- och AI-byra. Du analyserar kundmoten for att identifiera saljmojligheter och nasta steg. Returnera alltid valid JSON.",
      }),
    });

    if (!response.ok) return;

    const result = await response.json();
    const analysisText = result.content?.[0]?.text || "";

    const jsonStr = analysisText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const analysis = JSON.parse(jsonStr);

    await supabaseAdmin
      .from("meeting_transcriptions")
      .update({ analysis, analyzed_at: new Date().toISOString() })
      .eq("id", transcriptionId);

    // Create tasks for action items assigned to us
    if (analysis.action_items?.length > 0) {
      for (const item of analysis.action_items) {
        if (item.assignee === "oss" || item.assignee === "vi") {
          await supabaseAdmin.from("tasks").insert({
            contact_id: contactId,
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
  } catch (error) {
    console.error("Background analysis error:", error);
  }
}

// --- Main handler ---

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method Not Allowed");
    }

    let contact_id: string | undefined;
    try {
      if (!FIREFLIES_API_KEY) {
        return createErrorResponse(500, "FIREFLIES_API_KEY not configured");
      }

      const body = await req.json();
      const { contact_id: cid, import_meeting_id } = body;
      contact_id = cid;

      if (!contact_id) {
        return createErrorResponse(400, "contact_id is required");
      }

      // Get contact data for matching
      const contact = await getContactData(contact_id);
      if (!contact) {
        return createErrorResponse(404, "Contact not found");
      }

      // --- Import mode ---
      if (import_meeting_id) {
        const { data: contactFull } = await supabaseAdmin
          .from("contacts")
          .select("company_id")
          .eq("id", contact_id)
          .single();

        let result;
        try {
          result = await importTranscript(
            import_meeting_id,
            contact_id,
            contactFull?.company_id ?? null,
          );
        } catch (importError) {
          const msg =
            importError instanceof Error
              ? importError.message
              : String(importError);
          if (msg.includes("paid plan")) {
            return createErrorResponse(
              402,
              "Fireflies kräver en betald plan för att importera transkript. Uppgradera på fireflies.ai.",
            );
          }
          throw importError;
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // --- Search mode ---
      // Fetch recent transcripts from Fireflies (last 50)
      const data = await firefliesQuery(SEARCH_TRANSCRIPTS_QUERY, {
        limit: 50,
        skip: 0,
      });

      const transcripts: FirefliesTranscript[] = data?.transcripts ?? [];

      // Get already imported Fireflies meeting IDs
      const { data: existingTranscriptions } = await supabaseAdmin
        .from("meeting_transcriptions")
        .select("fireflies_meeting_id, contact_id")
        .not("fireflies_meeting_id", "is", null);

      const importedMap = new Map<string, number | null>();
      for (const et of existingTranscriptions ?? []) {
        if (et.fireflies_meeting_id) {
          importedMap.set(et.fireflies_meeting_id, et.contact_id);
        }
      }

      // Match and score transcripts
      const matches = transcripts
        .map((t) => {
          const { matched, match_type } = matchesContact(t, contact);
          const alreadyImported = importedMap.has(t.id);
          const linkedToThisContact = importedMap.get(t.id) === contact_id;

          return {
            fireflies_id: t.id,
            title: t.title,
            date: t.date,
            duration: t.duration,
            transcript_url: t.transcript_url,
            short_summary:
              t.summary?.short_summary ?? t.summary?.overview ?? null,
            attendees: (t.meeting_attendees ?? []).map((a) => ({
              name: a.displayName,
              email: a.email,
            })),
            match_type,
            matched,
            already_imported: alreadyImported,
            linked_to_contact: linkedToThisContact,
          };
        })
        .filter((t) => t.matched)
        .sort((a, b) => {
          // Sort: email > name > company, then by date desc
          const typeOrder: Record<string, number> = {
            email: 0,
            name: 1,
            name_in_title: 2,
            company: 3,
          };
          const orderDiff =
            (typeOrder[a.match_type] ?? 9) - (typeOrder[b.match_type] ?? 9);
          if (orderDiff !== 0) return orderDiff;
          return (
            new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
          );
        });

      return new Response(
        JSON.stringify({
          contact: {
            id: contact.id,
            name: [contact.first_name, contact.last_name]
              .filter(Boolean)
              .join(" "),
            emails: contact.emails,
            company_name: contact.company_name,
          },
          matches,
          total_searched: transcripts.length,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    } catch (error) {
      console.error(
        "fetch_fireflies_transcripts error (contact_id=%s):",
        contact_id ?? "unknown",
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Internal error",
      );
    }
  }),
);
