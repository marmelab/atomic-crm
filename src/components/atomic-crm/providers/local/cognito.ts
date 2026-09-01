const STORAGE_KEY = "ardley-crm.cognito";

export interface CognitoSession {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
  name?: string;
  sub?: string;
  customerId?: string;
}

export function cognitoConfig() {
  const poolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const redirectUri =
    import.meta.env.VITE_COGNITO_REDIRECT_URI ||
    `${window.location.origin}/auth/callback`;
  const logoutUri =
    import.meta.env.VITE_COGNITO_LOGOUT_URI || `${window.location.origin}/`;
  return { poolId, clientId, domain, redirectUri, logoutUri };
}

export function isCognitoConfigured(): boolean {
  const { poolId, clientId, domain } = cognitoConfig();
  return Boolean(poolId && clientId && domain);
}

export function readSession(): CognitoSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CognitoSession;
  } catch {
    return null;
  }
}

export function writeSession(session: CognitoSession) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

function decodeJwt(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as Record<string, unknown>;
}

export function sessionFromTokens(tokens: {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}): CognitoSession {
  const claims = decodeJwt(tokens.id_token);
  const expiresIn = tokens.expires_in ?? 3600;
  return {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
    email: typeof claims.email === "string" ? claims.email : undefined,
    name:
      typeof claims.name === "string"
        ? claims.name
        : [claims.given_name, claims.family_name].filter(Boolean).join(" ") ||
          undefined,
    sub: typeof claims.sub === "string" ? claims.sub : undefined,
    customerId:
      typeof claims["custom:customerId"] === "string"
        ? claims["custom:customerId"]
        : undefined,
  };
}

export function hostedLoginUrl(): string {
  const { clientId, domain, redirectUri } = cognitoConfig();
  if (!clientId || !domain) throw new Error("cognito_not_configured");
  const url = new URL(`${domain}/oauth2/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

export function hostedLogoutUrl(): string {
  const { clientId, domain, logoutUri } = cognitoConfig();
  if (!clientId || !domain) throw new Error("cognito_not_configured");
  const url = new URL(`${domain}/logout`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("logout_uri", logoutUri);
  return url.toString();
}

export async function exchangeCode(code: string): Promise<CognitoSession> {
  const { clientId, domain, redirectUri } = cognitoConfig();
  if (!clientId || !domain) throw new Error("cognito_not_configured");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${domain}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`cognito_token ${res.status}`);
  }
  const tokens = (await res.json()) as {
    id_token: string;
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return sessionFromTokens(tokens);
}
