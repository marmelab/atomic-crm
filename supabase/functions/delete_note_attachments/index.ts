import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AuthMiddleware } from "../_shared/authentication.ts";
import {
  ATTACHMENTS_BUCKET,
  getPathsToDelete,
  type WebhookPayload,
} from "../_shared/noteAttachments.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const deleteNoteAttachments = async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  const payload = (await req.json()) as WebhookPayload;
  const paths = getPathsToDelete(payload);

  if (paths.length === 0) {
    return jsonResponse({
      status: "skipped",
      reason: "no_paths_to_delete",
    });
  }

  const { error } = await supabaseAdmin.storage
    .from(ATTACHMENTS_BUCKET)
    .remove(paths);

  if (error) {
    console.error("Failed to delete note attachments", {
      type: payload.type ?? null,
      paths,
      error,
    });
    return jsonResponse({ error: "Failed to delete note attachments" }, 500);
  }

  return jsonResponse({
    status: "ok",
  });
};

Deno.serve(async (req: Request) =>
  AuthMiddleware(req, async (req: Request) => deleteNoteAttachments(req)),
);

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
