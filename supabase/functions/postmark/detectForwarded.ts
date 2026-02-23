/**
 * Detects whether an inbound email is a forwarded message, and if so,
 * extracts the original sender and body.
 *
 * Detection strategy (in order of preference):
 * 1. RFC 5321 `Resent-From` header — most reliable, set by some clients.
 * 2. Known body separator patterns injected by Gmail, Outlook, Apple Mail, etc.
 *
 * Returns:
 *  - isForwarded: true when a forwarding signal was detected
 *  - originalFrom: parsed { name, email } of the original sender (may be undefined if parsing failed)
 *  - originalBody: the body of the original message, minus the forwarding header block
 */

export type ForwardedInfo = {
  isForwarded: boolean;
  originalFrom?: { name: string; email: string };
  originalBody?: string;
};

/** Patterns that mark the beginning of a forwarded block in the email body. */
const FORWARD_SEPARATOR_PATTERNS = [
  // Gmail
  /^-{5,}\s*Forwarded message\s*-{5,}/im,
  // Apple Mail
  /^Begin forwarded message:/im,
  // Outlook / Exchange
  /^-{5,}\s*Original Message\s*-{5,}/im,
  // Outlook horizontal line separator
  /^_{10,}/m,
  // French clients (Transféré / Message transféré)
  /^-{5,}\s*Message transf[eé]r[eé]\s*-{5,}/im,
  /^-{5,}\s*Transf[eé]r[eé]\s*-{5,}/im,
  // German (Weitergeleitet)
  /^-{5,}\s*Weitergeleitete Nachricht\s*-{5,}/im,
];

/**
 * Parses a raw "From" header value such as:
 *   "John Doe" <john@example.com>
 *   John Doe <john@example.com>
 *   john@example.com
 */
const parseFromLine = (
  raw: string,
): { name: string; email: string } | undefined => {
  // Format: "Name" <email> or Name <email>
  const angleMatch = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (angleMatch) {
    return { name: angleMatch[1].trim(), email: angleMatch[2].trim() };
  }
  // Bare email address
  const emailMatch = raw.match(/^[\w.+%-]+@[\w.-]+\.[a-zA-Z]{2,}$/);
  if (emailMatch) {
    return { name: "", email: raw.trim() };
  }
  return undefined;
};

/**
 * Given the text that follows a forwarding separator, extracts the original
 * sender's From line and the body that comes after the header block.
 *
 * The header block is a sequence of lines that look like "Key: value"
 * (From, Date, Subject, To, Cc, …), potentially followed by a blank line.
 */
const parseForwardedBlock = (
  blockText: string,
): {
  originalFrom?: { name: string; email: string };
  originalBody?: string;
} => {
  const lines = blockText.split("\n");
  let originalFrom: { name: string; email: string } | undefined;
  let bodyStartIndex = 0;

  // Walk through the header-like lines at the top of the block
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Blank line signals end of the forwarded header block
    if (line.trim() === "") {
      bodyStartIndex = i + 1;
      break;
    }
    // Try to capture the From: line
    const fromMatch = line.match(/^From:\s*(.+)$/i);
    if (fromMatch) {
      originalFrom = parseFromLine(fromMatch[1].trim());
    }
    i++;
  }

  const originalBody = lines.slice(bodyStartIndex).join("\n").trim();
  return { originalFrom, originalBody };
};

export const detectForwarded = (
  subject: string,
  textBody: string,
  headers: { Name: string; Value: string }[] = [],
): ForwardedInfo => {
  // ── Strategy 1: Resent-From header ──────────────────────────────────────────
  const resentFrom = headers.find(
    (h) => h.Name.toLowerCase() === "resent-from",
  );
  if (resentFrom) {
    const originalFrom = parseFromLine(resentFrom.Value);
    return { isForwarded: true, originalFrom };
  }

  // ── Strategy 2: Body separator patterns ─────────────────────────────────────
  for (const pattern of FORWARD_SEPARATOR_PATTERNS) {
    const match = textBody.match(pattern);
    if (match && match.index !== undefined) {
      const blockText = textBody
        .slice(match.index + match[0].length)
        .trimStart();
      const { originalFrom, originalBody } = parseForwardedBlock(blockText);
      return { isForwarded: true, originalFrom, originalBody };
    }
  }

  // ── Strategy 3: Subject prefix ───────────────────────────────────────────────
  const subjectHasForwardPrefix = /^(fwd?|tr|wg|ts)\s*:/i.test(subject.trim());

  // still flag as forwarded
  // but we cannot parse the original sender, so return without originalFrom.
  if (subjectHasForwardPrefix) {
    return { isForwarded: true };
  }

  return { isForwarded: false };
};
