import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  advanceOutreachStatus,
  eventTypeToStatus,
  mapInstantlyEvent,
} from "./eventToMutation.ts";

const WEBHOOK_SECRET = Deno.env.get("INSTANTLY_WEBHOOK_SECRET");

interface WebhookBody {
  event_type?: string;
  type?: string;
  event?: string;
  lead_email?: string;
  email?: string;
  lead?: { email?: string };
  campaign_name?: string;
  campaign?: string;
  timestamp?: string;
  occurred_at?: string;
  reply_text?: string;
  reply_text_snippet?: string;
  text?: string;
  preview?: string;
}

const ack = (message: string) => new Response(message, { status: 200 });

const getEmail = (body: WebhookBody): string | null => {
  const raw = body.lead_email ?? body.email ?? body.lead?.email ?? null;
  return raw ? raw.toLowerCase() : null;
};

// Set the matching email's verification to Invalid (Instantly bounce).
const markEmailInvalid = (
  emailJsonb: { email: string; type?: string }[] | null,
  email: string,
  when: string,
) =>
  (emailJsonb ?? []).map((entry) =>
    entry.email?.toLowerCase() === email
      ? {
          ...entry,
          verification: {
            status: "Invalid",
            diagnosis: "Bounced in Instantly",
            checkedAt: when,
          },
        }
      : entry,
  );

async function getOrCreateTagId(name: string): Promise<number | null> {
  const { data: existing } = await supabaseAdmin
    .from("tags")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabaseAdmin
    .from("tags")
    .insert({ name, color: "#e8cb7d" })
    .select("id")
    .single();
  if (error || !created) return null;
  return created.id;
}

async function resolveSalesId(
  contactSalesId: number | null,
): Promise<number | null> {
  if (contactSalesId) return contactSalesId;
  const { data } = await supabaseAdmin
    .from("sales")
    .select("id")
    .neq("disabled", true)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!WEBHOOK_SECRET) {
    return new Response("Webhook not configured", { status: 500 });
  }
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = body.event_type ?? body.type ?? body.event;
  const mapped = mapInstantlyEvent(eventType);
  if (!mapped) return ack("Ignored event");

  const email = getEmail(body);
  if (!email) return ack("No lead email");

  const occurredAt =
    body.timestamp ?? body.occurred_at ?? new Date().toISOString();
  const campaign = body.campaign_name ?? body.campaign ?? null;
  const summary =
    body.reply_text ??
    body.reply_text_snippet ??
    body.text ??
    body.preview ??
    null;

  const { data: contact, error: contactError } = await supabaseAdmin
    .from("contacts")
    .select("*")
    .contains("email_jsonb", JSON.stringify([{ email }]))
    .maybeSingle();
  if (contactError) {
    return new Response(`Lookup failed: ${contactError.message}`, {
      status: 500,
    });
  }
  if (!contact) return ack("No matching contact");

  // 1. Append the timeline event.
  await supabaseAdmin.from("outreach_events").insert({
    contact_id: contact.id,
    type: mapped.type,
    campaign,
    summary,
    occurred_at: occurredAt,
    payload: body,
  });

  // 2. Advance the denormalized contact fields.
  const contactUpdate: Record<string, unknown> = {
    last_outreach_at: occurredAt,
  };
  const status = eventTypeToStatus(mapped.type);
  if (status) {
    contactUpdate.outreach_status = advanceOutreachStatus(
      contact.outreach_status,
      status,
    );
  }
  if (mapped.type === "emailed") contactUpdate.last_emailed_at = occurredAt;
  if (campaign && !contact.instantly_campaign) {
    contactUpdate.instantly_campaign = campaign;
  }
  if (mapped.markEmailInvalid) {
    contactUpdate.email_jsonb = markEmailInvalid(
      contact.email_jsonb,
      email,
      occurredAt,
    );
  }
  if (mapped.addTag) {
    const tagId = await getOrCreateTagId(mapped.addTag);
    if (tagId && !(contact.tags ?? []).includes(tagId)) {
      contactUpdate.tags = [...(contact.tags ?? []), tagId];
    }
  }
  await supabaseAdmin
    .from("contacts")
    .update(contactUpdate)
    .eq("id", contact.id);

  // 3. Replies also land in the notes timeline.
  if (mapped.addNote) {
    const salesId = await resolveSalesId(contact.sales_id);
    await supabaseAdmin.from("contact_notes").insert({
      contact_id: contact.id,
      text: summary ? `Reply via Instantly: ${summary}` : "Reply via Instantly",
      sales_id: salesId,
      date: occurredAt,
      status: "warm",
    });
  }

  return ack("ok");
});
