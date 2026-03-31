/**
 * Validate that a Google OAuth token exchange response has the expected shape.
 * Throws with a truncated body dump for debugging if validation fails.
 *
 * Extracted to its own file (no jsr: imports) so it can be tested
 * directly with Vitest without Deno module resolution issues.
 */
export function validateGoogleTokenResponse(data: unknown): {
  access_token: string;
  expires_in: number;
} {
  if (
    data == null ||
    typeof data !== "object" ||
    !("access_token" in data) ||
    typeof (data as Record<string, unknown>).access_token !== "string" ||
    !(data as Record<string, unknown>).access_token ||
    !("expires_in" in data) ||
    typeof (data as Record<string, unknown>).expires_in !== "number" ||
    !Number.isFinite((data as Record<string, unknown>).expires_in) ||
    ((data as Record<string, unknown>).expires_in as number) <= 0
  ) {
    const preview = JSON.stringify(data)?.slice(0, 200) ?? String(data);
    throw new Error(`Invalid Google token response: ${preview}`);
  }
  return {
    access_token: (data as Record<string, unknown>).access_token as string,
    expires_in: (data as Record<string, unknown>).expires_in as number,
  };
}
