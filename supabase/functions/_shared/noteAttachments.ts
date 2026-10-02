export const ATTACHMENTS_BUCKET =
  Deno.env.get("VITE_ATTACHMENTS_BUCKET") || "attachments";

type NoteAttachment = {
  path?: string | null;
  src?: string | null;
};

type NoteRecord = {
  id?: number | string | null;
  attachments?: NoteAttachment[] | null;
};

export type WebhookPayload = {
  type?: string | null;
  old_record?: NoteRecord | null;
  record?: NoteRecord | null;
};

export const getPathsToDelete = (payload: WebhookPayload): string[] => {
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
