import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

// Why this endpoint refuses.
//
// mergeContacts() in index.ts repoints tasks, contact_notes and deals, and
// then deletes the losing Contact. Everything else that points at a
// Contact is left to the foreign key: client_sessions,
// contact_stripe_customers, sales_calls and waitlist_entries all CASCADE,
// so a merge destroys them; applications and waitlist_invitations are NO
// ACTION, so a merge of anybody who ever applied aborts partway instead.
//
// No real merge has ever run through this endpoint — every historical
// merge was a deliberate SQL migration — so refusing costs nothing and
// closes the one live path that can delete business history.
//
// The decision lives in this module, on purpose, and this module imports
// nothing that can reach the database. That is the guarantee: there is no
// code path from a refused request to a query, let alone to a write.

export const CONTACT_MERGE_DISABLED_CODE = "contact_merge_disabled";

export const CONTACT_MERGE_DISABLED_MESSAGE =
  "Contact merge is temporarily unavailable while identity safety work is being completed.";

/** 503: the endpoint exists and is deliberately not serving. */
export const CONTACT_MERGE_DISABLED_STATUS = 503;

export interface ContactMergeRefusal {
  success: false;
  code: typeof CONTACT_MERGE_DISABLED_CODE;
  message: string;
  /** Stated outright, so no caller has to infer it from a status code. */
  merged: false;
}

export const contactMergeRefusalBody = (): ContactMergeRefusal => ({
  success: false,
  code: CONTACT_MERGE_DISABLED_CODE,
  message: CONTACT_MERGE_DISABLED_MESSAGE,
  merged: false,
});

/**
 * Answer an authenticated request to this endpoint.
 *
 * `userId` is recorded so an attempt is visible in the function logs. The
 * request body is deliberately never read, so no contact identifiers are
 * captured — there is no merge to audit, only the attempt.
 */
export const handleContactMergeRequest = (
  req: Request,
  userId: string,
  log: (line: string) => void = console.warn,
): Response => {
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method Not Allowed");
  }

  log(
    JSON.stringify({
      event: CONTACT_MERGE_DISABLED_CODE,
      at: new Date().toISOString(),
      attempted_by: userId,
    }),
  );

  return new Response(JSON.stringify(contactMergeRefusalBody()), {
    status: CONTACT_MERGE_DISABLED_STATUS,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};
