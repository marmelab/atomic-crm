/** Patterns that mark the beginning of a forwarded block in the email body. */
const FORWARD_SEPARATOR_PATTERNS = [
  // Gmail
  /^-{5,}\s*Forwarded message\s*-{5,}/im,
  // Apple Mail
  /^Begin forwarded message:/im,
  // Outlook / Exchange
  /^-{5,}\s*Original Message\s*-{5,}/im,
  // French clients (Transféré / Message transféré)
  /^-{5,}\s*Message transf[eé]r[eé]\s*-{5,}/im,
  /^-{5,}\s*Transf[eé]r[eé]\s*-{5,}/im,
  // German (Weitergeleitet)
  /^-{5,}\s*Weitergeleitete Nachricht\s*-{5,}/im,
];

export const stripForwardingHeaderBlock = (text: string): string => {
  const lines = text.split("\n");
  let bodyStartIndex = 0;

  // First check that the first line matches a known forwarding separator pattern
  const hasForwardedSeparator = FORWARD_SEPARATOR_PATTERNS.some((pattern) => {
    const match = lines[0].match(pattern);
    return !!match;
  });
  if (!hasForwardedSeparator) {
    // No known forwarding pattern detected, return the original text
    return text.trim();
  }

  // Walk through the header-like lines at the top of the block
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Blank line signals end of the forwarded header block
    if (line.trim() === "") {
      bodyStartIndex = i + 1;
      break;
    }
    i++;
  }

  const strippedBody = lines.slice(bodyStartIndex).join("\n").trim();

  if (strippedBody === "") {
    // If stripping the header block results in an empty body, return the original text
    console.warn(
      "Stripping forwarded header block resulted in empty body, returning original text",
    );
    return text.trim();
  }

  return strippedBody;
};

export const stripSubjectForwardingPrefix = (subject: string): string => {
  const result = subject
    .replace(/^(Fwd|FW|FWD|Tr|SV|VS|WG|WG:)\s*[:-]\s*/i, "")
    .trim();

  if (result.length === 0) {
    console.warn(
      `Stripping forwarding prefix from subject "${subject}" resulted in empty string, returning original subject`,
    );
    return subject;
  }

  return result;
};
