import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sql } from "https://esm.sh/kysely@0.27.2";
import { AuthMiddleware } from "../_shared/authentication.ts";
import { db } from "../_shared/db.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getCandidateNames, type WebhookPayload } from "./candidateNames.ts";

const ATTACHMENTS_BUCKET =
  Deno.env.get("VITE_ATTACHMENTS_BUCKET") || "attachments";

// The note triggers call this function when a note is updated or deleted,
// sending the note as it was before the change.
//
// Any logged-in user can call this endpoint with a made-up payload, so the
// payload is not trusted: its attachments are only files we *may* delete.
// Each of them is deleted only if no row of the database still uses it.
// At worst, a caller can delete files that nothing uses anymore.
const deleteNoteAttachments = async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const candidates = getCandidateNames(payload);
  if (candidates.length === 0) {
    return jsonResponse({ status: "skipped", reason: "no_candidate_files" });
  }

  let paths: string[];
  try {
    paths = await getUnreferencedNames(candidates);
  } catch (error) {
    console.error("Failed to check note attachment references", { error });
    return jsonResponse(
      { error: "Failed to check note attachment references" },
      500,
    );
  }

  if (paths.length === 0) {
    return jsonResponse({ status: "skipped", reason: "still_referenced" });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(ATTACHMENTS_BUCKET)
    .remove(paths);

  if (error) {
    console.error("Failed to delete note attachments", { paths, error });
    return jsonResponse({ error: "Failed to delete note attachments" }, 500);
  }

  return jsonResponse({ status: "ok", deleted: data.length });
};

Deno.serve(async (req: Request) =>
  AuthMiddleware(req, async (req: Request) => deleteNoteAttachments(req)),
);

// Returns the files that no row uses anymore, among the given ones.
//
// A file counts as used when its number (`0.8262106278726917` for
// `0.8262106278726917.pdf`) appears anywhere in one of the columns listed in
// `refs`. We search for the number only, because the extension may be
// URL-encoded in a stored URL.
//
// This runs after the note change is saved, so the edited note is checked with
// its new attachments: a file the note still has is kept.
//
// Every column that can hold uploaded files MUST be listed in `refs`. Otherwise,
// a file used both by a note and by that column gets deleted when the note
// drops it.
const getUnreferencedNames = async (names: string[]): Promise<string[]> => {
  const { rows } = await sql<{ name: string }>`
    with candidates as (
      select name, substring(name from '^0\\.[0-9]+') as stem
      from jsonb_array_elements_text(${JSON.stringify(names)}::jsonb) as name
    ),
    refs as (
      select attachments::text as text from public.contact_notes
      union all select attachments::text from public.deal_notes
      union all select logo::text from public.companies
      union all select avatar::text from public.contacts
      union all select avatar::text from public.sales
      union all select config::text from public.configuration
    )
    select c.name
    from candidates c
    where not exists (
      select 1 from refs where strpos(refs.text, c.stem) > 0
    )
  `.execute(db);

  return rows.map((row) => row.name);
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
