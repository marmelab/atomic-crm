import type { User } from "jsr:@supabase/supabase-js@2";
import { createErrorResponse } from "./utils.ts";
import { supabaseAdmin } from "./supabaseAdmin.ts";

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
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (data?.user && !error) return await next(req);

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
    const token = getAuthToken(req);
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (!data?.user || authError) {
      return createErrorResponse(401, "Unauthorized");
    }

    return next(req, data.user);
  } catch (err) {
    return createErrorResponse(401, err?.toString() || "Unauthorized");
  }
};
