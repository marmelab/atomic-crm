// Maps a raw MyEmailVerifier `validate_single` response into the CRM's
// EmailVerification shape.
//
// This mirrors `EmailVerification` in
// `src/components/atomic-crm/types.ts`. The two are kept in sync by hand
// because this Deno edge function cannot import from the Vite app.

export type EmailVerificationStatus =
  | "Valid"
  | "Invalid"
  | "Catch-all"
  | "Unknown";

export interface EmailVerification {
  status: EmailVerificationStatus;
  diagnosis?: string;
  roleBased?: boolean;
  disposable?: boolean;
  freeDomain?: boolean;
  checkedAt: string; // ISO timestamp
}

// MyEmailVerifier returns every boolean as the string "true" / "false".
const asBool = (value: unknown): boolean =>
  String(value).trim().toLowerCase() === "true";

const normalizeStatus = (raw: unknown): EmailVerificationStatus => {
  const value = String(raw).trim().toLowerCase();
  if (value === "valid") return "Valid";
  if (value === "invalid") return "Invalid";
  if (value === "catch-all" || value === "catchall" || value === "catch all") {
    return "Catch-all";
  }
  return "Unknown";
};

export interface RawVerifyResponse {
  Address?: string;
  Status?: string;
  catch_all?: string;
  Disposable_Domain?: string;
  Role_Based?: string;
  Free_Domain?: string;
  Greylisted?: string;
  Diagnosis?: string;
}

export const mapResponse = (
  raw: RawVerifyResponse,
  checkedAt: string = new Date().toISOString(),
): EmailVerification => {
  let status = normalizeStatus(raw.Status);
  // Some responses signal a catch-all domain only via the boolean flag.
  if (status === "Unknown" && asBool(raw.catch_all)) {
    status = "Catch-all";
  }
  return {
    status,
    diagnosis: raw.Diagnosis || undefined,
    roleBased: asBool(raw.Role_Based),
    disposable: asBool(raw.Disposable_Domain),
    freeDomain: asBool(raw.Free_Domain),
    checkedAt,
  };
};
