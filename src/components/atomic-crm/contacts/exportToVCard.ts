import type { Contact, Company } from "../types";

/**
 * Folds a long line according to vCard specification (max 75 chars per line)
 * Continuation lines start with a space
 */
function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) return line;

  const result: string[] = [];
  let currentLine = line.substring(0, maxLength);
  let remaining = line.substring(maxLength);

  result.push(currentLine);

  while (remaining.length > 0) {
    // Continuation lines start with a space and can have 74 more chars
    const chunkSize = maxLength - 1;
    currentLine = " " + remaining.substring(0, chunkSize);
    remaining = remaining.substring(chunkSize);
    result.push(currentLine);
  }

  return result.join("\r\n");
}

/**
 * Converts a contact and their company to vCard 3.0 format
 */
export function exportToVCard(
  contact: Contact,
  company?: Company,
  photoData?: { base64: string; mimeType: string },
): string {
  const lines: string[] = [];

  // vCard header
  lines.push("BEGIN:VCARD");
  lines.push("VERSION:3.0");

  // Name (N: Family Name;Given Name;Additional Names;Honorific Prefixes;Honorific Suffixes)
  lines.push(`N:${contact.last_name};${contact.first_name};;;`);

  // Formatted name
  lines.push(`FN:${contact.first_name} ${contact.last_name}`);

  // Title/Job position
  if (contact.title) {
    lines.push(`TITLE:${contact.title}`);
  }

  // Organization
  if (company?.name) {
    lines.push(`ORG:${company.name}`);
  }

  // Emails
  if (contact.email_jsonb && contact.email_jsonb.length > 0) {
    contact.email_jsonb.forEach((emailObj) => {
      const type = emailObj.type.toUpperCase();
      lines.push(`EMAIL;TYPE=${type}:${emailObj.email}`);
    });
  }

  // Phone numbers
  if (contact.phone_jsonb && contact.phone_jsonb.length > 0) {
    contact.phone_jsonb.forEach((phoneObj) => {
      const type = phoneObj.type.toUpperCase();
      lines.push(`TEL;TYPE=${type}:${phoneObj.number}`);
    });
  }

  // LinkedIn URL
  if (contact.linkedin_url) {
    lines.push(`URL:${contact.linkedin_url}`);
  }

  // Background/Note
  if (contact.background) {
    // Escape newlines and special characters in notes
    const escapedNote = contact.background
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
    lines.push(`NOTE:${escapedNote}`);
  }

  // Photo/Avatar - vCard 3.0 format with base64 encoding
  if (photoData) {
    // Extract image type from MIME type (e.g., "image/png" -> "PNG")
    const imageType = photoData.mimeType.split("/")[1]?.toUpperCase() || "PNG";

    // vCard 3.0 format: PHOTO;ENCODING=b;TYPE=PNG:
    const photoLine = `PHOTO;ENCODING=b;TYPE=${imageType}:${photoData.base64}`;
    lines.push(foldLine(photoLine));
  }

  // vCard footer
  lines.push("END:VCARD");

  return lines.join("\r\n");
}
