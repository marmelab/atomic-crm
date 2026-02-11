import { corsHeaders } from "./cors.ts";

export function createErrorResponse(
  status: number,
  message: string,
  custom: Record<string, unknown> = {},
) {
  return new Response(JSON.stringify({ status, message, ...custom }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    status,
  });
}
