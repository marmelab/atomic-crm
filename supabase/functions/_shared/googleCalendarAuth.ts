import * as jose from "jsr:@panva/jose@6";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

let cachedToken: { access_token: string; expires_at: number } | null = null;

/**
 * Build a signed JWT for the Google service account and exchange it
 * for a short-lived access token via Google's OAuth2 token endpoint.
 *
 * Tokens are cached in memory until 60 s before expiry.
 */
export async function getGoogleAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    return cachedToken.access_token;
  }

  const clientEmail = Deno.env.get("GOOGLE_CALENDAR_CLIENT_EMAIL") ?? "";
  const privateKeyPem = (
    Deno.env.get("GOOGLE_CALENDAR_PRIVATE_KEY") ?? ""
  ).replace(/\\n/g, "\n");

  const privateKey = await jose.importPKCS8(privateKeyPem, "RS256");

  const now = Math.floor(Date.now() / 1000);
  const jwt = await new jose.SignJWT({
    iss: clientEmail,
    sub: clientEmail,
    scope: CALENDAR_SCOPE,
    aud: GOOGLE_TOKEN_URL,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.access_token;
}
