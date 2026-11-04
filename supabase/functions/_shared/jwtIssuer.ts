/**
 * Issuers accepted for Supabase Auth JWTs.
 *
 * Tokens carry the public URL of the auth server (`API_EXTERNAL_URL`) as `iss`.
 * When the Supabase stack is served under another hostname (e.g. a self-hosted
 * instance behind a reverse proxy), that URL differs from both `SUPABASE_URL`
 * and the local development value of `SB_JWT_ISSUER`, so every token would be
 * rejected. The issuer advertised by the auth server itself is therefore
 * accepted too. Signatures are still verified against the project JWKS.
 *
 * Returns `discovered: false` when the auth server could not be queried, so
 * callers can retry later instead of caching the incomplete list.
 */
export const getAcceptedIssuers = async (
  supabaseUrl: string,
  configuredIssuer: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<{ issuers: string[]; discovered: boolean }> => {
  const issuers = new Set([configuredIssuer ?? `${supabaseUrl}/auth/v1`]);
  try {
    const response = await fetchFn(
      `${supabaseUrl}/auth/v1/.well-known/openid-configuration`,
    );
    if (!response.ok) {
      return { issuers: [...issuers], discovered: false };
    }
    const { issuer } = await response.json();
    if (typeof issuer === "string" && issuer) {
      issuers.add(issuer);
    }
    return { issuers: [...issuers], discovered: true };
  } catch {
    return { issuers: [...issuers], discovered: false };
  }
};
