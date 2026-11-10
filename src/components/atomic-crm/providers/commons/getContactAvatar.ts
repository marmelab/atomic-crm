import { DOMAINS_NOT_SUPPORTING_FAVICON } from "../../misc/unsupportedDomains.const";
import type { Contact } from "../../types";
import { getFaviconUrl } from "./getFaviconUrl";

export async function hash(string: string) {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest("SHA-256", utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((bytes) => bytes.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

// Helper function to get the Gravatar URL
async function getGravatarUrl(email: string): Promise<string> {
  const hashEmail = await hash(email);
  return `https://www.gravatar.com/avatar/${hashEmail}?d=404`;
}

// Main function to get the avatar URL
export async function getContactAvatar(
  record: Partial<Contact>,
): Promise<string | null> {
  if (!record.email_jsonb || !record.email_jsonb.length) {
    return null;
  }

  for (const { email } of record.email_jsonb) {
    // Step 1: Try to get Gravatar image
    const gravatarUrl = await getGravatarUrl(email);

    try {
      const gravatarResponse = await fetch(gravatarUrl);
      if (gravatarResponse.ok) {
        return gravatarUrl;
      }
    } catch {
      // Gravatar not found
    }

    // Step 2: Try to get favicon from email domain
    const domain = email.split("@")[1];
    if (domain && !DOMAINS_NOT_SUPPORTING_FAVICON.includes(domain)) {
      return getFaviconUrl(domain);
    }

    // TODO: Step 3: Try to get image from LinkedIn.
  }

  return null;
}
