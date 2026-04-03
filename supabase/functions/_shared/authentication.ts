import { createClient, type User } from "jsr:@supabase/supabase-js@2";
import { createErrorResponse } from "./utils.ts";

function getAuthToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [bearer, token] = authHeader.split(" ");
  return bearer === "Bearer" ? token : null;
}

/**
 * Validates the Authorization header to ensure that a user is authenticated.
 * Uses supabase.auth.getUser() — works with all token types (ES256, HS256).
 */
export const AuthMiddleware = async (
  req: Request,
  next: (req: Request) => Promise<Response>,
) => {
  if (req.method === "OPTIONS") return await next(req);

  const token = getAuthToken(req);
  if (!token) {
    return createErrorResponse(401, "Missing authorization header");
  }

  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ??
        Deno.env.get("SB_PUBLISHABLE_KEY") ??
        "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      console.error("[auth] getUser failed:", error?.message);
      return createErrorResponse(401, "Invalid authentication");
    }
    return await next(req);
  } catch (e) {
    console.error("[auth] Unexpected error:", e);
    return createErrorResponse(401, "Unauthorized");
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
