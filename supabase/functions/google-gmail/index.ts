import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { googleFetch } from "../_shared/googleAuth.ts";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface GmailMessageHeader {
  name: string;
  value: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  payload?: {
    headers?: GmailMessageHeader[];
  };
}

function getHeader(
  headers: GmailMessageHeader[] | undefined,
  name: string,
): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function listMessages(
  userId: string,
  params: {
    emails: string[];
    maxResults?: number;
    pageToken?: string;
  },
) {
  // Build Gmail search query: from/to any of the contact's emails
  const emailQueries = params.emails
    .map((email) => `from:${email} OR to:${email}`)
    .join(" OR ");
  const query = `(${emailQueries})`;

  const queryParams = new URLSearchParams({
    q: query,
    maxResults: String(params.maxResults ?? 15),
  });
  if (params.pageToken) queryParams.set("pageToken", params.pageToken);

  const listUrl = `${GMAIL_API_BASE}/messages?${queryParams}`;
  const listResponse = await googleFetch(userId, listUrl);

  if (!listResponse.ok) {
    const errorBody = await listResponse.text();
    console.error("Gmail list error:", listResponse.status, errorBody);
    throw new Error(`Gmail API error: ${listResponse.status}`);
  }

  const listData = await listResponse.json();
  const messageIds: Array<{ id: string; threadId: string }> =
    listData.messages ?? [];

  if (messageIds.length === 0) {
    return { messages: [], nextPageToken: null, totalEstimate: 0 };
  }

  // Fetch details for each message (headers + snippet)
  // Use batch approach: fetch in parallel but limit concurrency
  const messages = await Promise.all(
    messageIds.slice(0, params.maxResults ?? 15).map(async (msg) => {
      const msgUrl = `${GMAIL_API_BASE}/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`;
      const msgResponse = await googleFetch(userId, msgUrl);

      if (!msgResponse.ok) return null;

      const msgData: GmailMessage = await msgResponse.json();
      const headers = msgData.payload?.headers;

      return {
        id: msgData.id,
        threadId: msgData.threadId,
        subject: getHeader(headers, "Subject"),
        from: getHeader(headers, "From"),
        to: getHeader(headers, "To"),
        date: getHeader(headers, "Date"),
        snippet: msgData.snippet,
        internalDate: msgData.internalDate,
      };
    }),
  );

  return {
    messages: messages.filter(Boolean),
    nextPageToken: listData.nextPageToken ?? null,
    totalEstimate: listData.resultSizeEstimate ?? 0,
  };
}

async function getMessage(
  userId: string,
  params: { messageId: string },
) {
  const url = `${GMAIL_API_BASE}/messages/${params.messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date&metadataHeaders=Cc`;
  const response = await googleFetch(userId, url);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Gmail get error:", response.status, errorBody);
    throw new Error(`Gmail API error: ${response.status}`);
  }

  const msgData: GmailMessage = await response.json();
  const headers = msgData.payload?.headers;

  return {
    id: msgData.id,
    threadId: msgData.threadId,
    subject: getHeader(headers, "Subject"),
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    cc: getHeader(headers, "Cc"),
    date: getHeader(headers, "Date"),
    snippet: msgData.snippet,
    internalDate: msgData.internalDate,
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
            case "list-messages":
              if (!params.emails?.length) {
                return createErrorResponse(400, "Missing emails parameter");
              }
              result = await listMessages(user!.id, params);
              break;

            case "get-message":
              if (!params.messageId) {
                return createErrorResponse(400, "Missing messageId parameter");
              }
              result = await getMessage(user!.id, params);
              break;

            default:
              return createErrorResponse(400, `Unknown action: ${action}`);
          }

          return new Response(JSON.stringify({ data: result }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (e) {
          console.error("google-gmail error:", e);
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
