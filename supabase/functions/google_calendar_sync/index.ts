import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getGoogleAccessToken } from "../_shared/googleCalendarAuth.ts";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID") ?? "";

// --- Types ---

interface SyncPayload {
  action: "create" | "update" | "delete";
  service_id: string;
}

interface ServiceRow {
  id: string;
  service_date: string;
  service_end?: string | null;
  all_day: boolean;
  service_type: string;
  description?: string | null;
  location?: string | null;
  travel_destination?: string | null;
  google_event_id?: string | null;
  project_id?: string | null;
  client_id?: string | null;
}

// --- Service type labels (server-side, kept minimal) ---

const SERVICE_TYPE_LABELS: Record<string, string> = {
  riprese: "Riprese",
  montaggio: "Montaggio",
  riprese_montaggio: "Riprese + Montaggio",
  fotografia: "Fotografia",
  sviluppo_web: "Sviluppo Web",
  altro: "Altro",
};

// --- Google Calendar helpers ---

function buildCalendarEvent(
  service: ServiceRow,
  clientName?: string | null,
  projectName?: string | null,
) {
  const typeLabel =
    SERVICE_TYPE_LABELS[service.service_type] ?? service.service_type;
  const parts = [typeLabel];
  if (clientName) parts.push(clientName);
  if (projectName) parts.push(projectName);
  const summary = parts.join(" — ");

  const eventLocation =
    service.location || service.travel_destination || undefined;

  const descriptionLines: string[] = [];
  if (service.description) descriptionLines.push(service.description);
  descriptionLines.push(
    `\nGestionale: servizio #${service.id}`,
  );

  // Date handling: all_day → date fields, otherwise dateTime
  // DB may return ISO timestamps like "2023-03-21T00:00:00+00:00", extract date part
  const startDate = service.service_date.slice(0, 10);
  const endDate = (service.service_end || service.service_date).slice(0, 10);

  if (service.all_day) {
    // Google Calendar all-day events use exclusive end date
    const endExclusive = addDays(endDate, 1);
    return {
      summary,
      description: descriptionLines.join("\n"),
      location: eventLocation,
      start: { date: startDate },
      end: { date: endExclusive },
    };
  }

  // Timed event: default 09:00–18:00 in Europe/Rome
  return {
    summary,
    description: descriptionLines.join("\n"),
    location: eventLocation,
    start: { dateTime: `${startDate}T09:00:00`, timeZone: "Europe/Rome" },
    end: { dateTime: `${endDate}T18:00:00`, timeZone: "Europe/Rome" },
  };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function calendarFetch(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const token = await getGoogleAccessToken();
  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(CALENDAR_ID)}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown = null;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    const text = await res.text();
    if (text) data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

// --- Core sync logic ---

async function fetchServiceWithContext(serviceId: string) {
  const { data: service, error } = await supabaseAdmin
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .single();
  if (error || !service) return null;

  let clientName: string | null = null;
  let projectName: string | null = null;

  if (service.client_id) {
    const { data } = await supabaseAdmin
      .from("clients")
      .select("company_name")
      .eq("id", service.client_id)
      .single();
    clientName = data?.company_name ?? null;
  }

  if (service.project_id) {
    const { data } = await supabaseAdmin
      .from("projects")
      .select("name")
      .eq("id", service.project_id)
      .single();
    projectName = data?.name ?? null;
  }

  return { service: service as ServiceRow, clientName, projectName };
}

async function createEvent(serviceId: string) {
  const ctx = await fetchServiceWithContext(serviceId);
  if (!ctx) return { error: "Service not found" };

  const event = buildCalendarEvent(
    ctx.service,
    ctx.clientName,
    ctx.projectName,
  );
  const res = await calendarFetch("/events", "POST", event);
  if (!res.ok) {
    console.error("Google Calendar create failed", res);
    return { error: `Google Calendar API error: ${res.status}` };
  }

  const { id: googleEventId, htmlLink } = res.data as {
    id: string;
    htmlLink: string;
  };

  // Save the event ID and link back to the service
  await supabaseAdmin
    .from("services")
    .update({ google_event_id: googleEventId, google_event_link: htmlLink })
    .eq("id", serviceId);

  return { google_event_id: googleEventId, google_event_link: htmlLink };
}

async function updateEvent(serviceId: string) {
  const ctx = await fetchServiceWithContext(serviceId);
  if (!ctx) return { error: "Service not found" };

  // If no event exists yet, create one instead
  if (!ctx.service.google_event_id) {
    return createEvent(serviceId);
  }

  const event = buildCalendarEvent(
    ctx.service,
    ctx.clientName,
    ctx.projectName,
  );
  const eventId = ctx.service.google_event_id;
  const res = await calendarFetch(
    `/events/${encodeURIComponent(eventId)}`,
    "PUT",
    event,
  );

  if (!res.ok) {
    // If event was deleted from Calendar, create a new one
    if (res.status === 404) {
      return createEvent(serviceId);
    }
    console.error("Google Calendar update failed", res);
    return { error: `Google Calendar API error: ${res.status}` };
  }

  return { google_event_id: eventId };
}

async function deleteEvent(serviceId: string) {
  const { data: service } = await supabaseAdmin
    .from("services")
    .select("google_event_id")
    .eq("id", serviceId)
    .single();

  if (!service?.google_event_id) {
    return { message: "No linked event" };
  }

  const eventId = service.google_event_id;
  const res = await calendarFetch(
    `/events/${encodeURIComponent(eventId)}`,
    "DELETE",
  );

  // 404 / 410 = already gone, that's fine
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    console.error("Google Calendar delete failed", res);
    return { error: `Google Calendar API error: ${res.status}` };
  }

  // Clear the event ID and link from the service
  await supabaseAdmin
    .from("services")
    .update({ google_event_id: null, google_event_link: null })
    .eq("id", serviceId);

  return { deleted: eventId };
}

// --- Request handler ---

async function handleRequest(req: Request) {
  const payload = (await req.json()) as SyncPayload;

  if (!payload.action || !payload.service_id) {
    return createErrorResponse(400, "action and service_id are required");
  }

  if (!["create", "update", "delete"].includes(payload.action)) {
    return createErrorResponse(400, `Invalid action: ${payload.action}`);
  }

  if (!CALENDAR_ID) {
    return createErrorResponse(
      500,
      "GOOGLE_CALENDAR_ID is not configured",
    );
  }

  try {
    let result;
    switch (payload.action) {
      case "create":
        result = await createEvent(payload.service_id);
        break;
      case "update":
        result = await updateEvent(payload.service_id);
        break;
      case "delete":
        result = await deleteEvent(payload.service_id);
        break;
    }

    if (result && "error" in result) {
      return createErrorResponse(502, result.error as string);
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("google_calendar_sync.error", error);
    return createErrorResponse(500, "Calendar sync failed");
  }
}

// --- Entry point ---

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (request) =>
    AuthMiddleware(request, async (authedRequest) =>
      UserMiddleware(authedRequest, async (_, user) => {
        const currentUserSale = user ? await getUserSale(user) : null;
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (authedRequest.method === "POST") {
          return handleRequest(authedRequest);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
