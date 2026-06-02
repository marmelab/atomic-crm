import { decodeJwt, jwtVerify, type JWTVerifyGetKey } from "npm:jose@5";
import type { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { refreshOAuthAccessToken } from "./oauthToken.ts";

export interface AuthInfo {
  token: string;
  userId: string;
  role?: string;
  clientId?: string;
}

interface CachedAccessToken {
  accessToken: string;
  expiresAtMs: number;
  userId: string;
  role?: string;
  clientId?: string;
}

let cachedAccessToken: CachedAccessToken | null = null;

function getAgentOAuthConfig(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = Deno.env.get("MCP_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("MCP_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function secretsEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

async function loadRefreshToken(
  pool: Pool,
  clientId: string,
): Promise<string | null> {
  const client = await pool.connect();
  try {
    const result = await client.queryObject<{ refresh_token: string }>(
      `SELECT refresh_token FROM public.mcp_oauth_agent_credentials WHERE oauth_client_id = $1`,
      [clientId],
    );
    return result.rows[0]?.refresh_token ?? null;
  } finally {
    client.release();
  }
}

export async function saveRefreshToken(
  pool: Pool,
  clientId: string,
  refreshToken: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.queryObject(
      `INSERT INTO public.mcp_oauth_agent_credentials (oauth_client_id, refresh_token, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (oauth_client_id)
       DO UPDATE SET refresh_token = EXCLUDED.refresh_token, updated_at = now()`,
      [clientId, refreshToken],
    );
  } finally {
    client.release();
  }
}

export async function hasAgentCredentials(
  pool: Pool,
  clientId: string,
): Promise<boolean> {
  const refreshToken = await loadRefreshToken(pool, clientId);
  return refreshToken != null;
}

async function getAgentAccessToken(
  pool: Pool,
  clientId: string,
  clientSecret: string,
): Promise<CachedAccessToken | null> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAtMs > now + 60_000) {
    return cachedAccessToken;
  }

  const refreshToken = await loadRefreshToken(pool, clientId);
  if (!refreshToken) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return null;

  let tokenResponse;
  try {
    tokenResponse = await refreshOAuthAccessToken(
      supabaseUrl,
      clientId,
      clientSecret,
      refreshToken,
    );
  } catch (error) {
    console.error("[MCP agent auth] refresh failed:", error);
    cachedAccessToken = null;
    return null;
  }

  if (tokenResponse.refresh_token) {
    await saveRefreshToken(pool, clientId, tokenResponse.refresh_token);
  }

  const accessToken = tokenResponse.access_token;
  const payload = decodeJwt(accessToken);
  if (!payload.sub) return null;

  const expiresIn = tokenResponse.expires_in ?? 3600;
  cachedAccessToken = {
    accessToken,
    expiresAtMs: now + expiresIn * 1000,
    userId: payload.sub,
    role: payload.role as string | undefined,
    clientId: payload.client_id as string | undefined,
  };

  return cachedAccessToken;
}

export async function resolveAuthInfo(
  bearerToken: string,
  pool: Pool,
  jwks: JWTVerifyGetKey,
  issuer: string,
): Promise<AuthInfo | null> {
  try {
    const { payload } = await jwtVerify(bearerToken, jwks, { issuer });
    if (!payload.sub) return null;
    return {
      token: bearerToken,
      userId: payload.sub,
      role: payload.role as string | undefined,
      clientId: payload.client_id as string | undefined,
    };
  } catch {
    // Not a user JWT — try OAuth client secret for static-secret MCP clients.
  }

  const agentConfig = getAgentOAuthConfig();
  if (!agentConfig) return null;
  if (!secretsEqual(bearerToken, agentConfig.clientSecret)) return null;

  const cached = await getAgentAccessToken(
    pool,
    agentConfig.clientId,
    agentConfig.clientSecret,
  );
  if (!cached) return null;

  return {
    token: cached.accessToken,
    userId: cached.userId,
    role: cached.role,
    clientId: cached.clientId ?? agentConfig.clientId,
  };
}

/** Clears in-memory cache (for tests). */
export function clearAgentAccessTokenCache(): void {
  cachedAccessToken = null;
}
