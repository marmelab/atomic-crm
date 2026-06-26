import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { mapResponse, type EmailVerification } from "./mapResponse.ts";

// Option-1 "new" endpoint — optimized for speed / automation.
const VALIDATE_ENDPOINT =
  "https://api.myemailverifier.com/api/validate_single.php";

// Safety cap per request. The 30 req/min rate limit is respected by
// verifying sequentially below; callers throttle across contacts.
const MAX_EMAILS_PER_REQUEST = 50;

interface VerifyResult {
  email: string;
  verification: EmailVerification | null;
  error?: string;
}

async function verifyOne(email: string, apiKey: string): Promise<VerifyResult> {
  try {
    const url = `${VALIDATE_ENDPOINT}?apikey=${encodeURIComponent(
      apiKey,
    )}&email=${encodeURIComponent(email)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      return {
        email,
        verification: null,
        error: `Verifier returned ${response.status}`,
      };
    }
    const raw = await response.json();
    return { email, verification: mapResponse(raw) };
  } catch (e) {
    return { email, verification: null, error: (e as Error).message };
  }
}

async function verifyEmails(req: Request): Promise<Response> {
  let body: { emails?: unknown };
  try {
    body = await req.json();
  } catch {
    return createErrorResponse(400, "Invalid JSON body");
  }

  const emails = Array.isArray(body.emails)
    ? body.emails.filter(
        (e): e is string => typeof e === "string" && e.length > 0,
      )
    : [];

  if (emails.length === 0) {
    return createErrorResponse(
      400,
      "Provide a non-empty 'emails' string array",
    );
  }
  if (emails.length > MAX_EMAILS_PER_REQUEST) {
    return createErrorResponse(
      400,
      `Too many emails in one request (max ${MAX_EMAILS_PER_REQUEST})`,
    );
  }

  const apiKey = Deno.env.get("MYEMAILVERIFIER_API_KEY");
  if (!apiKey) {
    return createErrorResponse(500, "Email verification is not configured");
  }

  // Verify sequentially to stay within the provider's rate limit.
  const data: VerifyResult[] = [];
  for (const email of emails) {
    data.push(await verifyOne(email, apiKey));
  }

  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve((req: Request) =>
  OptionsMiddleware(req, (req) =>
    AuthMiddleware(req, (req) =>
      UserMiddleware(req, (req) => {
        if (req.method === "POST") {
          return verifyEmails(req);
        }
        return Promise.resolve(createErrorResponse(405, "Method Not Allowed"));
      }),
    ),
  ),
);
