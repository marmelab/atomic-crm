import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";

async function updatePassword(user: any) {
  const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(
    user.email,
  );

  if (!data || error) {
    return createErrorResponse(500, "Internal Server Error");
  }

  return new Response(
    JSON.stringify({
      data,
    }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
}

Deno.serve(async (req: Request) =>
  AuthMiddleware(req, async (req) =>
    UserMiddleware(req, async (req, user) => {
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      }

      if (req.method === "PATCH") {
        return updatePassword(user);
      }

      return createErrorResponse(405, "Method Not Allowed");
    }),
  ),
);
