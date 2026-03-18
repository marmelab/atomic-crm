import { supabaseAdmin } from "./supabaseAdmin.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface GoogleTokenRow {
  id: number;
  user_id: string;
  sales_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string[];
  google_email: string | null;
}

/**
 * Retrieve a valid Google access token for the given user.
 * Automatically refreshes the token if expired.
 */
export async function getValidGoogleAccessToken(
  userId: string,
): Promise<string> {
  const { data: tokenRow, error } = await supabaseAdmin
    .from("google_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .single<GoogleTokenRow>();

  if (error || !tokenRow) {
    throw new Error("GOOGLE_NOT_CONNECTED");
  }

  const now = new Date();
  const expiresAt = new Date(tokenRow.expires_at);

  // Refresh if token expires within 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    return await refreshAccessToken(userId, tokenRow.refresh_token);
  }

  return tokenRow.access_token;
}

async function refreshAccessToken(
  userId: string,
  refreshToken: string,
): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Google token refresh failed:", errorBody);
    // If refresh fails, delete the tokens (user needs to reconnect)
    await supabaseAdmin
      .from("google_oauth_tokens")
      .delete()
      .eq("user_id", userId);
    throw new Error("GOOGLE_TOKEN_EXPIRED");
  }

  const data = await response.json();

  const expiresAt = new Date(
    Date.now() + (data.expires_in ?? 3600) * 1000,
  ).toISOString();

  await supabaseAdmin
    .from("google_oauth_tokens")
    .update({
      access_token: data.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return data.access_token;
}

/**
 * Make an authenticated Google API request.
 * Automatically handles token retrieval and refresh.
 */
export async function googleFetch(
  userId: string,
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const accessToken = await getValidGoogleAccessToken(userId);

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // If we get a 401, try refreshing the token once
  if (response.status === 401) {
    const { data: tokenRow } = await supabaseAdmin
      .from("google_oauth_tokens")
      .select("refresh_token")
      .eq("user_id", userId)
      .single();

    if (tokenRow) {
      const newToken = await refreshAccessToken(userId, tokenRow.refresh_token);
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    }
  }

  return response;
}

/**
 * Check if a user has connected their Google account.
 */
export async function getGoogleConnectionStatus(userId: string) {
  const { data: tokenRow } = await supabaseAdmin
    .from("google_oauth_tokens")
    .select("google_email, scopes")
    .eq("user_id", userId)
    .single();

  if (!tokenRow) {
    return { connected: false, email: null, scopes: [] };
  }

  return {
    connected: true,
    email: tokenRow.google_email,
    scopes: tokenRow.scopes,
  };
}
