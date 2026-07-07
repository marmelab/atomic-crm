import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { hasAgentCredentials, saveRefreshToken } from "../mcp/agentAuth.ts";
import { exchangeAuthorizationCode } from "../mcp/oauthToken.ts";

const connectionString =
  Deno.env.get("SUPABASE_DB_URL") ||
  "postgresql://postgres:postgres@db:5432/postgres";
const pool = new Pool(connectionString, 1);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAgentOAuthConfig(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = Deno.env.get("MCP_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("MCP_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return UserMiddleware(req, async (req, user) => {
    if (!user) {
      return createErrorResponse(401, "Unauthorized");
    }

    const sale = await getUserSale(user);
    if (!sale?.administrator) {
      return createErrorResponse(
        403,
        "Only administrators can configure MCP agent credentials",
      );
    }

    const agentConfig = getAgentOAuthConfig();
    if (!agentConfig) {
      return createErrorResponse(
        503,
        "MCP agent OAuth is not configured (set MCP_OAUTH_CLIENT_ID and MCP_OAUTH_CLIENT_SECRET secrets)",
      );
    }

    if (req.method === "GET") {
      const configured = await hasAgentCredentials(pool, agentConfig.clientId);
      return jsonResponse({
        configured,
        oauth_client_id: agentConfig.clientId,
      });
    }

    if (req.method === "POST") {
      let body: {
        refresh_token?: string;
        code?: string;
        redirect_uri?: string;
        code_verifier?: string;
      };
      try {
        body = await req.json();
      } catch {
        return createErrorResponse(400, "Invalid JSON body");
      }

      let refreshToken = body.refresh_token;

      if (!refreshToken && body.code && body.redirect_uri) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL");
          if (!supabaseUrl) {
            return createErrorResponse(500, "SUPABASE_URL is not configured");
          }
          const tokenResponse = await exchangeAuthorizationCode(
            supabaseUrl,
            agentConfig.clientId,
            agentConfig.clientSecret,
            body.code,
            body.redirect_uri,
            body.code_verifier,
          );
          refreshToken = tokenResponse.refresh_token;
        } catch (error) {
          return createErrorResponse(
            400,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      if (!refreshToken) {
        return createErrorResponse(
          400,
          "Provide refresh_token or code + redirect_uri",
        );
      }

      await saveRefreshToken(pool, agentConfig.clientId, refreshToken);
      return jsonResponse({
        success: true,
        oauth_client_id: agentConfig.clientId,
      });
    }

    if (req.method === "DELETE") {
      const client = await pool.connect();
      try {
        await client.queryObject(
          `DELETE FROM public.mcp_oauth_agent_credentials WHERE oauth_client_id = $1`,
          [agentConfig.clientId],
        );
      } finally {
        client.release();
      }
      return jsonResponse({ success: true });
    }

    return createErrorResponse(405, "Method not allowed");
  });
});
