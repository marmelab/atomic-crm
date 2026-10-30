import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sql } from "https://esm.sh/kysely@0.27.2";
import { AuthMiddleware } from "../_shared/authentication.ts";
import { db } from "../_shared/db.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const ATTACHMENTS_BUCKET =
  Deno.env.get("VITE_ATTACHMENTS_BUCKET") || "attachments";

// Leaves time for a freshly uploaded file to be saved in its note, logo or avatar.
const ORPHAN_GRACE_PERIOD = "1 hour";
const MAX_FILES_PER_CALL = 1000;

// Called by the note triggers, but the request body is ignored on purpose:
// any authenticated user can call this endpoint, so it must never let the caller
// pick which files to delete. Instead it removes every file of the bucket that no
// row references anymore, which also catches files orphaned by changes the
// triggers never see (MCP or SQL edits, lost webhook calls, replaced logos).
const deleteOrphanAttachments = async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  let paths: string[];
  try {
    paths = await getOrphanPaths();
  } catch (error) {
    console.error("Failed to list orphan attachments", { error });
    return jsonResponse({ error: "Failed to list orphan attachments" }, 500);
  }

  if (paths.length === 0) {
    return jsonResponse({ status: "skipped", reason: "no_orphan_files" });
  }

  const { error } = await supabaseAdmin.storage
    .from(ATTACHMENTS_BUCKET)
    .remove(paths);

  if (error) {
    console.error("Failed to delete orphan attachments", { paths, error });
    return jsonResponse({ error: "Failed to delete orphan attachments" }, 500);
  }

  return jsonResponse({ status: "ok", deleted: paths.length });
};

Deno.serve(async (req: Request) =>
  AuthMiddleware(req, async (req: Request) => deleteOrphanAttachments(req)),
);

// Uploads are named `${Math.random()}${extension}`. A file is referenced when its
// numeric stem (`0.8262106278726917`) appears in a column that stores uploaded
// files: the extension may be URL-encoded in a stored `src`, so it is ignored.
// Every column holding uploaded files MUST be listed here, otherwise its files
// get deleted. Files not named that way are never deleted.
const getOrphanPaths = async (): Promise<string[]> => {
  const { rows } = await sql<{ name: string }>`
    with refs as (
      select attachments::text as text from public.contact_notes
      union all select attachments::text from public.deal_notes
      union all select logo::text from public.companies
      union all select avatar::text from public.contacts
      union all select avatar::text from public.sales
      union all select config::text from public.configuration
    ),
    referenced_stems as (
      select distinct match[1] as stem
      from refs, regexp_matches(refs.text, '(0\\.[0-9]+)', 'g') as match
    )
    select o.name
    from storage.objects o
    where o.bucket_id = ${ATTACHMENTS_BUCKET}
      and o.created_at < now() - ${ORPHAN_GRACE_PERIOD}::interval
      and substring(o.name from '^0\\.[0-9]+') not in (
        select stem from referenced_stems
      )
    limit ${MAX_FILES_PER_CALL}
  `.execute(db);

  return rows.map((row) => row.name);
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
