import { corsHeaders } from "./cors.ts";

export function createErrorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ status, message }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    status,
  });
}
