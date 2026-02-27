import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { ATTACHMENTS_BUCKET } from "../../../src/components/atomic-crm/providers/commons/attachments.ts";

const DEFAULT_WEBHOOK_SECRET = "atomic-crm-note-attachments-webhook-secret";

type NoteAttachment = {
  path?: string | null;
  src?: string | null;
};

type NoteRecord = {
  id?: number | string | null;
  attachments?: NoteAttachment[] | null;
};

type WebhookPayload = {
  type?: string | null;
  old_record?: NoteRecord | null;
  record?: NoteRecord | null;
};

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

Deno.serve(async (req: Request) => {
  if (!isWebhookRequestAuthenticated(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  return deleteNoteAttachments(req);
});

const isWebhookRequestAuthenticated = (req: Request) => {
  const providedSecret = req.headers.get("x-webhook-secret");
  if (!providedSecret) {
    return false;
  }

  const expectedSecret =
    Deno.env.get("ATTACHMENTS_WEBHOOK_SECRET") ?? DEFAULT_WEBHOOK_SECRET;

  return providedSecret === expectedSecret;
};

const getPathsToDelete = (payload: WebhookPayload): string[] => {
  const oldPaths = extractAttachmentPaths(payload.old_record?.attachments);
  const newPaths = extractAttachmentPaths(payload.record?.attachments);

  if (payload.type === "UPDATE") {
    const newPathsSet = new Set(newPaths);
    return oldPaths.filter((path) => !newPathsSet.has(path));
  }

  if (payload.type === "DELETE") {
    return oldPaths;
  }

  return [];
};

const extractAttachmentPaths = (
  attachments?: NoteAttachment[] | null,
): string[] => {
  const paths = attachments
    ?.map((attachment) => extractAttachmentPath(attachment))
    .filter((path): path is string => path != null && path.length > 0);

  return paths ? Array.from(new Set(paths)) : [];
};

const extractAttachmentPath = (attachment?: NoteAttachment | null) => {
  if (!attachment) {
    return null;
  }

  if (attachment.path) {
    return normalizeStoragePath(attachment.path);
  }

  if (!attachment.src) {
    return null;
  }

  const pathname = getPathname(attachment.src);
  if (!pathname) {
    return null;
  }

  const bucketSegment = `/${ATTACHMENTS_BUCKET}/`;
  const bucketIndex = pathname.lastIndexOf(bucketSegment);
  if (bucketIndex < 0) {
    return null;
  }

  const path = pathname.slice(bucketIndex + bucketSegment.length);
  return normalizeStoragePath(path);
};

const getPathname = (value: string) => {
  try {
    return new URL(value, "http://localhost").pathname;
  } catch {
    return null;
  }
};

const safelyDecodePath = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

const normalizeStoragePath = (path: string) => {
  const trimmedPath = path.trim();
  if (trimmedPath.length === 0) {
    return null;
  }

  const parsedPath = getPathname(trimmedPath);
  const candidatePath = parsedPath ?? trimmedPath;

  const bucketSegment = `/${ATTACHMENTS_BUCKET}/`;
  const bucketIndex = candidatePath.lastIndexOf(bucketSegment);
  const withoutBucket =
    bucketIndex >= 0
      ? candidatePath.slice(bucketIndex + bucketSegment.length)
      : candidatePath.replace(/^\/+/, "").replace(/^attachments\//, "");

  if (withoutBucket.length === 0) {
    return null;
  }

  return safelyDecodePath(withoutBucket);
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
