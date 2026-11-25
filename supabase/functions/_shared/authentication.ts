// Based on https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/_shared/jwt/default.ts
import * as jose from "jsr:@panva/jose@6";
import { createClient, type User } from "jsr:@supabase/supabase-js@2";
import { getAcceptedIssuers } from "./jwtIssuer.ts";
import { createErrorResponse } from "./utils.ts";

const SUPABASE_JWT_KEYS = jose.createRemoteJWKSet(
  new URL(Deno.env.get("SUPABASE_URL")! + "/auth/v1/.well-known/jwks.json"),
);

function getAuthToken(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }
  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer") {
    throw new Error(`Auth header is not 'Bearer {token}'`);
  }

  return token;
}

let acceptedIssuers: Promise<string[]> | undefined;

function getSupabaseJWTIssuers() {
  acceptedIssuers ??= getAcceptedIssuers(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SB_JWT_ISSUER"),
  ).then(({ issuers, discovered }) => {
    // Retry the discovery on the next request if the auth server was unreachable
    if (!discovered) acceptedIssuers = undefined;
    return issuers;
  });
  return acceptedIssuers;
}

async function verifySupabaseJWT(jwt: string) {
  return jose.jwtVerify(jwt, SUPABASE_JWT_KEYS, {
    issuer: await getSupabaseJWTIssuers(),
  });
}

/**
 * Validates the Authorization header to ensure that a user is authenticated.
 */
export const AuthMiddleware = async (
  req: Request,
  next: (req: Request) => Promise<Response>,
) => {
  if (req.method === "OPTIONS") return await next(req);

  try {
    const token = getAuthToken(req);
    const isValidJWT = await verifySupabaseJWT(token);

    if (isValidJWT) return await next(req);

    return createErrorResponse(401, "Invalid authentication");
  } catch (e) {
    return createErrorResponse(401, e?.toString() || "Unauthorized");
  }
};

/**
 * Get the authenticated user using the authorization header.
 * User will be undefined for OPTIONS requests.
 */
export const UserMiddleware = async (
  req: Request,
  next: (req: Request, user?: User) => Promise<Response>,
) => {
  if (req.method === "OPTIONS") return await next(req);

  try {
    const authHeader = req.headers.get("Authorization")!;
    const localClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SB_PUBLISHABLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data, error: authError } = await localClient.auth.getUser();
    if (!data?.user || authError) {
      return createErrorResponse(401, "Unauthorized");
    }

    return next(req, data.user);
  } catch (err) {
    return createErrorResponse(401, err?.toString() || "Unauthorized");
  }
};
