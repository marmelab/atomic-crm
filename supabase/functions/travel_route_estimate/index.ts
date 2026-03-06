import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  estimateTravelRoute,
  validateTravelRouteEstimatePayload,
} from "../_shared/travelRouteEstimate.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";

async function handleTravelRouteEstimate(
  req: Request,
  currentUserSale: unknown,
) {
  if (!currentUserSale) {
    return createErrorResponse(401, "Unauthorized");
  }

  if (!googleMapsApiKey) {
    return createErrorResponse(
      500,
      "GOOGLE_MAPS_API_KEY non configurata nelle Edge Functions",
    );
  }

  const payload = await req.json();
  const validation = validateTravelRouteEstimatePayload(payload);

  if (validation.error || !validation.data) {
    return createErrorResponse(
      400,
      validation.error ?? "Payload non valido per il calcolo tratta km",
    );
  }

  try {
    const estimate = await estimateTravelRoute({
      apiKey: googleMapsApiKey,
      baseUrl: "",
      payload: validation.data,
    });

    return new Response(JSON.stringify({ data: estimate }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("travel_route_estimate.error", error);
    const message =
      error instanceof Error
        ? error.message
        : "Impossibile calcolare la tratta km richiesta";

    if (message.includes("Nessun risultato di geocoding")) {
      return createErrorResponse(400, message);
    }

    return createErrorResponse(500, message);
  }
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (request) =>
    AuthMiddleware(request, async (authedRequest) =>
      UserMiddleware(authedRequest, async (_, user) => {
        const currentUserSale = user ? await getUserSale(user) : null;
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (authedRequest.method === "POST") {
          return handleTravelRouteEstimate(authedRequest, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
