const MAX_CANDIDATES_PER_CALL = 100;

// The app uploads every file at the root of the bucket, named
// `${Math.random()}${extension}`, e.g. `0.8262106278726917.pdf`.
const UPLOADED_FILE_NAME = /^0\.[0-9]+(\.[^./]*)?$/;

type NoteAttachment = {
  path?: string | null;
  src?: string | null;
};

export type WebhookPayload = {
  old_record?: { attachments?: NoteAttachment[] | null } | null;
};

// Returns the names of the files attached to the note before the change: the
// files we may delete. The payload is not trusted, so only names that look like
// files uploaded by the app are returned, at most MAX_CANDIDATES_PER_CALL.
export const getCandidateNames = (payload: WebhookPayload): string[] => {
  const attachments = payload?.old_record?.attachments;
  if (!Array.isArray(attachments)) {
    return [];
  }

  const names = Array.from(
    new Set(
      attachments
        .map(getFileName)
        .filter((name): name is string => name != null),
    ),
  );

  if (names.length > MAX_CANDIDATES_PER_CALL) {
    console.warn("Too many note attachments, only checking the first ones", {
      count: names.length,
      checked: MAX_CANDIDATES_PER_CALL,
    });
  }

  return names.slice(0, MAX_CANDIDATES_PER_CALL);
};

// Returns the file name of an attachment, read from its `path`, or from the end
// of its `src` URL when it has no path. Returns null for anything that does not
// look like a file uploaded by the app (e.g. `dir/0.1.pdf` or `../logo.png`),
// so the caller cannot point at other files of the bucket.
const getFileName = (attachment?: NoteAttachment | null) => {
  const name =
    typeof attachment?.path === "string" && attachment.path !== ""
      ? attachment.path
      : getLastPathSegment(attachment?.src);
  return name != null && UPLOADED_FILE_NAME.test(name) ? name : null;
};

const getLastPathSegment = (src?: string | null) => {
  if (typeof src !== "string") {
    return null;
  }
  try {
    const pathname = new URL(src).pathname;
    return safelyDecodePath(pathname.slice(pathname.lastIndexOf("/") + 1));
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
