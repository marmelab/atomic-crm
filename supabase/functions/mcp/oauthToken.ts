export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

type TokenEndpointAuthMethod = "client_secret_basic" | "client_secret_post";

function getTokenEndpointAuthMethod(): TokenEndpointAuthMethod {
  const configured = Deno.env.get("MCP_OAUTH_TOKEN_AUTH_METHOD");
  if (configured === "client_secret_post") return "client_secret_post";
  return "client_secret_basic";
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const credentials = `${clientId}:${clientSecret}`;
  const bytes = new TextEncoder().encode(credentials);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `Basic ${btoa(binary)}`;
}

export async function exchangeOAuthToken(
  tokenUrl: string,
  params: Record<string, string>,
  clientId: string,
  clientSecret: string,
  authMethod: TokenEndpointAuthMethod,
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams(params);
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  if (authMethod === "client_secret_basic") {
    headers.Authorization = basicAuthHeader(clientId, clientSecret);
  } else {
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OAuth token request failed (${response.status}): ${text}`);
  }

  return JSON.parse(text) as OAuthTokenResponse;
}

export async function refreshOAuthAccessToken(
  supabaseUrl: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<OAuthTokenResponse> {
  const tokenUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/oauth/token`;

  return exchangeOAuthToken(
    tokenUrl,
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    clientId,
    clientSecret,
    getTokenEndpointAuthMethod(),
  );
}

export async function exchangeAuthorizationCode(
  supabaseUrl: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<OAuthTokenResponse> {
  const tokenUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/oauth/token`;
  const params: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  };
  if (codeVerifier) {
    params.code_verifier = codeVerifier;
  }

  return exchangeOAuthToken(
    tokenUrl,
    params,
    clientId,
    clientSecret,
    getTokenEndpointAuthMethod(),
  );
}
