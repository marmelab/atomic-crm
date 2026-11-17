// Edge function copy of src/components/atomic-crm/providers/commons/attachments.ts
// (edge functions cannot import from src/). Keep both in sync with the bucket's
// allowed_mime_types (supabase/schemas/07_storage.sql).
const ALLOWED_MIME_TYPES = [
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

// Returns the type to upload a file with: its own type when the bucket allows
// it, application/octet-stream otherwise (no SVG, HTML or script served as is).
export const getSafeContentType = (type?: string | null): string => {
  const mimeType = (type ?? "").split(";")[0].trim().toLowerCase();
  return ALLOWED_MIME_TYPES.includes(mimeType) ? mimeType : DEFAULT_MIME_TYPE;
};
