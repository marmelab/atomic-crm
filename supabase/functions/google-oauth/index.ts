import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { getGoogleConnectionStatus } from "../_shared/googleAuth.ts";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function getGoogleConfig() {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth environment variables not configured");
  }

  return { clientId, clientSecret, redirectUri };
}

async function getAuthUrl(userId: string) {
  const { clientId, redirectUri } = getGoogleConfig();

  // Generate a random state parameter for CSRF protection
  const state = crypto.randomUUID();

  // Store state temporarily in the token table (will be overwritten on exchange)
  // We use a lightweight approach: include userId in state
  const statePayload = btoa(JSON.stringify({ userId, nonce: state }));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: statePayload,
    include_granted_scopes: "true",
  });

  return {
    url: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    state: statePayload,
  };
}

async function exchangeCode(
  userId: string,
  salesId: number,
  code: string,
) {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();

  // Exchange authorization code for tokens
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error("Token exchange failed:", errorBody);
    throw new Error("Failed to exchange authorization code");
  }

  const tokenData = await tokenResponse.json();

  if (!tokenData.refresh_token) {
    throw new Error(
      "No refresh token received. User may need to revoke access and reconnect.",
    );
  }

  // Get user's Google email
  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  let googleEmail: string | null = null;
  if (userInfoResponse.ok) {
    const userInfo = await userInfoResponse.json();
    googleEmail = userInfo.email;
  }

  const expiresAt = new Date(
    Date.now() + (tokenData.expires_in ?? 3600) * 1000,
  ).toISOString();

  const scopesList = (tokenData.scope ?? SCOPES).split(" ");

  // Upsert tokens
  const { error } = await supabaseAdmin
    .from("google_oauth_tokens")
    .upsert(
      {
        user_id: userId,
        sales_id: salesId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        scopes: scopesList,
        google_email: googleEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("Failed to store tokens:", error);
    throw new Error("Failed to store Google tokens");
  }

  // Create default preferences if not exist
  await supabaseAdmin
    .from("connector_preferences")
    .upsert(
      {
        user_id: userId,
        connector_type: "google",
        preferences: {
          showCalendarOnDashboard: true,
          showEmailsOnContact: true,
          showCalendarOnContact: true,
          syncContacts: false,
        },
      },
      { onConflict: "user_id,connector_type" },
    );

  return { connected: true, email: googleEmail, scopes: scopesList };
}

async function disconnect(userId: string) {
  const { error } = await supabaseAdmin
    .from("google_oauth_tokens")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete tokens:", error);
    throw new Error("Failed to disconnect Google");
  }

  return { connected: false };
}

async function revoke(userId: string) {
  // Get the current token to revoke
  const { data: tokenRow } = await supabaseAdmin
    .from("google_oauth_tokens")
    .select("access_token, refresh_token")
    .eq("user_id", userId)
    .single();

  if (tokenRow) {
    // Revoke at Google's end (use refresh_token if available, otherwise access_token)
    const tokenToRevoke = tokenRow.refresh_token || tokenRow.access_token;
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${tokenToRevoke}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch (e) {
      console.error("Google revoke call failed (non-critical):", e);
    }
  }

  // Delete tokens from our DB regardless
  return disconnect(userId);
}

async function getStatus(userId: string) {
  const status = await getGoogleConnectionStatus(userId);

  // Also fetch preferences
  const { data: prefs } = await supabaseAdmin
    .from("connector_preferences")
    .select("preferences")
    .eq("user_id", userId)
    .eq("connector_type", "google")
    .single();

  return {
    ...status,
    preferences: prefs?.preferences ?? {
      showCalendarOnDashboard: true,
      showEmailsOnContact: true,
      showCalendarOnContact: true,
      syncContacts: false,
    },
  };
}

async function updatePreferences(
  userId: string,
  preferences: Record<string, boolean>,
) {
  const { error } = await supabaseAdmin
    .from("connector_preferences")
    .upsert(
      {
        user_id: userId,
        connector_type: "google",
        preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,connector_type" },
    );

  if (error) {
    console.error("Failed to update preferences:", error);
    throw new Error("Failed to update preferences");
  }

  return { preferences };
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }

        const currentUserSale = await getUserSale(user);
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        try {
          const { action, ...params } = await req.json();

          let result: unknown;

          switch (action) {
            case "get-auth-url":
              result = await getAuthUrl(user!.id);
              break;

            case "exchange-code":
              if (!params.code) {
                return createErrorResponse(400, "Missing authorization code");
              }
              result = await exchangeCode(
                user!.id,
                currentUserSale.id,
                params.code,
              );
              break;

            case "disconnect":
              result = await disconnect(user!.id);
              break;

            case "revoke":
              result = await revoke(user!.id);
              break;

            case "status":
              result = await getStatus(user!.id);
              break;

            case "update-preferences":
              if (!params.preferences) {
                return createErrorResponse(400, "Missing preferences");
              }
              result = await updatePreferences(user!.id, params.preferences);
              break;

            default:
              return createErrorResponse(400, `Unknown action: ${action}`);
          }

          return new Response(JSON.stringify({ data: result }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (e) {
          console.error("google-oauth error:", e);
          const message = e instanceof Error ? e.message : "Internal error";
          const status = message === "GOOGLE_NOT_CONNECTED" ? 404 : 500;
          return createErrorResponse(status, message);
        }
      }),
    ),
  ),
);
