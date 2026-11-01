export const ATTACHMENTS_BUCKET =
  import.meta.env.VITE_ATTACHMENTS_BUCKET || "attachments";

// The bucket is public and serves each file with the content type it was
// uploaded with, so only types a browser cannot run are allowed (no SVG, HTML,
// XML or JavaScript). Keep in sync with the bucket's allowed_mime_types
// (supabase/schemas/07_storage.sql).
export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/octet-stream",
];

const DEFAULT_MIME_TYPE = "application/octet-stream";

/**
 * Returns the content type to upload a file with: its own type when the bucket
 * allows it, application/octet-stream otherwise (the browser downloads it
 * instead of rendering it).
 */
export const getSafeContentType = (type?: string | null): string => {
  const mimeType = (type ?? "").split(";")[0].trim().toLowerCase();
  return ALLOWED_MIME_TYPES.includes(mimeType) ? mimeType : DEFAULT_MIME_TYPE;
};
