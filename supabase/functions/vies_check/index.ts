import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { checkVat } from "../../../connectors/vies/index.ts";

/**
 * Checks an EU VAT number through the VIES connector for a signed-in user
 * (TZ section 5.1). The browser cannot call VIES itself (no CORS), and every
 * external call goes through a connector on the server.
 *
 * POST { countryCode: "PL", vatNumber: "7740001454" }
 *   → { status: "valid" | "invalid" | "unavailable", vatId, name?, address?, zipcode?, city? }
 */

const isCode = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z]{2}$/.test(value);

const isNumber = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 2 && value.length <= 32;

async function handle(req: Request): Promise<Response> {
  let payload: { countryCode?: unknown; vatNumber?: unknown };
  try {
    payload = await req.json();
  } catch {
    return createErrorResponse(400, "Expected a JSON body");
  }
  if (!isCode(payload.countryCode) || !isNumber(payload.vatNumber)) {
    return createErrorResponse(400, "countryCode and vatNumber are required");
  }

  const result = await checkVat(
    { countryCode: payload.countryCode, vatNumber: payload.vatNumber },
    { fetch },
  );
  if (result.status === "unavailable" && result.reason) {
    // No personal data in logs: the country and the reason only
    console.warn(
      `VIES unavailable for ${payload.countryCode}: ${result.reason}`,
    );
  }
  const { reason: _reason, ...answer } = result;

  return new Response(JSON.stringify(answer), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req) => {
        if (req.method === "POST") return handle(req);
        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
