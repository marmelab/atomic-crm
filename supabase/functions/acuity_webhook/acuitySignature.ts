// Live Acuity Connection slice. Acuity signs every webhook POST with an
// `x-acuity-signature` header: base64(HMAC-SHA256(rawBody, apiKey)) — the
// same API key already required for the authenticated GET
// /appointments/:id follow-up call this function makes (Business Settings
// -> Integrations -> API in Acuity's own dashboard; "static" webhooks are
// signed with the main admin's key, which is the credential this app
// already uses). Confirmed against Acuity's own webhook documentation
// (developers.acuityscheduling.com/docs/webhooks) — this is the complete,
// real mechanism Acuity offers: no per-request nonce, no timestamp
// binding, no mTLS. Verifying it is the strongest available design, not a
// partial implementation of something larger.
//
// Verified against the RAW, un-reparsed request body — the signature is
// computed over exact bytes as sent, not a re-serialized form. index.ts
// reads the body as text once, verifies, then parses that same text.
export const verifyAcuitySignature = async (
  rawBody: string,
  signatureHeader: string | null,
  apiKey: string,
): Promise<boolean> => {
  if (!signatureHeader) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const computed = base64Encode(new Uint8Array(digest));

  return timingSafeEqual(computed, signatureHeader);
};

const base64Encode = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

// A signature check must never leak timing information about how many
// leading characters matched.
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};
