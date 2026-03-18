import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { googleFetch } from "../_shared/googleAuth.ts";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    self?: boolean;
  }>;
  htmlLink?: string;
  status?: string;
  location?: string;
  organizer?: { email: string; displayName?: string; self?: boolean };
  created?: string;
  updated?: string;
}

async function listEvents(
  userId: string,
  params: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    orderBy?: string;
    q?: string;
  },
) {
  const queryParams = new URLSearchParams({
    singleEvents: "true",
    orderBy: params.orderBy ?? "startTime",
    maxResults: String(params.maxResults ?? 10),
  });

  if (params.timeMin) queryParams.set("timeMin", params.timeMin);
  if (params.timeMax) queryParams.set("timeMax", params.timeMax);
  if (params.q) queryParams.set("q", params.q);

  const url = `${CALENDAR_API_BASE}/calendars/primary/events?${queryParams}`;
  const response = await googleFetch(userId, url);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Calendar API error:", response.status, errorBody);
    throw new Error(`Calendar API error: ${response.status}`);
  }

  const data = await response.json();
  const events: CalendarEvent[] = data.items ?? [];

  return {
    events: events.map((event) => ({
      id: event.id,
      summary: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
      attendees: event.attendees?.filter((a) => !a.self) ?? [],
      htmlLink: event.htmlLink,
      status: event.status,
      location: event.location,
      organizer: event.organizer,
    })),
    totalResults: events.length,
  };
}

async function searchByAttendee(
  userId: string,
  params: {
    emails: string[];
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  },
) {
  // Calendar API doesn't support direct attendee filtering,
  // so we fetch more events and filter client-side
  const queryParams = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(Math.min((params.maxResults ?? 20) * 3, 100)),
  });

  if (params.timeMin) queryParams.set("timeMin", params.timeMin);
  if (params.timeMax) queryParams.set("timeMax", params.timeMax);

  const url = `${CALENDAR_API_BASE}/calendars/primary/events?${queryParams}`;
  const response = await googleFetch(userId, url);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Calendar API error:", response.status, errorBody);
    throw new Error(`Calendar API error: ${response.status}`);
  }

  const data = await response.json();
  const allEvents: CalendarEvent[] = data.items ?? [];

  const emailSet = new Set(params.emails.map((e) => e.toLowerCase()));
  const maxResults = params.maxResults ?? 20;

  const filtered = allEvents
    .filter((event) =>
      event.attendees?.some((a) => emailSet.has(a.email.toLowerCase())),
    )
    .slice(0, maxResults);

  return {
    events: filtered.map((event) => ({
      id: event.id,
      summary: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
      attendees: event.attendees?.filter((a) => !a.self) ?? [],
      htmlLink: event.htmlLink,
      status: event.status,
      location: event.location,
    })),
    totalResults: filtered.length,
  };
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }

        try {
          const { action, ...params } = await req.json();

          let result: unknown;

          switch (action) {
            case "list-events":
              result = await listEvents(user!.id, params);
              break;

            case "search-by-attendee":
              if (!params.emails?.length) {
                return createErrorResponse(400, "Missing emails parameter");
              }
              result = await searchByAttendee(user!.id, params);
              break;

            default:
              return createErrorResponse(400, `Unknown action: ${action}`);
          }

          return new Response(JSON.stringify({ data: result }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (e) {
          console.error("google-calendar error:", e);
          const message = e instanceof Error ? e.message : "Internal error";
          if (message === "GOOGLE_NOT_CONNECTED" || message === "GOOGLE_TOKEN_EXPIRED") {
            return createErrorResponse(401, message);
          }
          return createErrorResponse(500, message);
        }
      }),
    ),
  ),
);
