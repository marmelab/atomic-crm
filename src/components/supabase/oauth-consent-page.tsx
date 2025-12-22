// src/pages/OAuthConsent.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthProvider } from "ra-core";

/**
 * Authorization UI for OAuth Consent Page
 *
 * When third-party apps initiate OAuth, users will be redirected to this page
 * to approve or deny the authorization request.
 *
 * Anonymous users will be redirected to the login page first.
 *
 * Inspired from https://supabase.com/docs/guides/auth/oauth-server/getting-started?queryGroups=oauth-setup&oauth-setup=dashboard#example-authorization-ui
 */
export function OAuthConsentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authorizationId = searchParams.get("authorization_id");
  const authProvider = useAuthProvider();

  const [authDetails, setAuthDetails] =
    useState<OAuthAuthorizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAuthDetails() {
      if (!authorizationId) {
        setError("Missing authorization_id");
        setLoading(false);
        return;
      }
      if (!authProvider) {
        setError("Auth provider not available");
        setLoading(false);
        return;
      }

      // Check if user is authenticated
      try {
        await authProvider.checkAuth({});
      } catch {
        navigate(
          `/login?redirect=/oauth/consent?authorization_id=${authorizationId}`,
        );
        return;
      }

      // Get authorization details using the authorization_id
      const { data, error } =
        await authProvider.getAuthorizationDetails(authorizationId);

      if (error) {
        setError(error.message);
      } else {
        setAuthDetails(data as OAuthAuthorizationDetails);
      }

      setLoading(false);
    }

    loadAuthDetails();
  }, [authProvider, authorizationId, navigate]);

  async function handleApprove() {
    if (!authorizationId || !authProvider) return;

    const { data, error } =
      await authProvider.approveAuthorization(authorizationId);

    if (error) {
      setError(error.message);
    } else {
      // Redirect to client app
      window.location.href = data.redirect_url;
    }
  }

  async function handleDeny() {
    if (!authorizationId || !authProvider) return;

    const { data, error } =
      await authProvider.denyAuthorization(authorizationId);

    if (error) {
      setError(error.message);
    } else {
      // Redirect to client app with error
      window.location.href = data.redirect_to;
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!authDetails) return <div>No authorization request found</div>;

  return (
    <div>
      <h1>Authorize {authDetails.client.name}</h1>
      <p>This application wants to access your account.</p>

      <div>
        <p>
          <strong>Client:</strong> {authDetails.client.name}
        </p>
        <p>
          <strong>Redirect URI:</strong> {authDetails.redirect_uri}
        </p>
        {authDetails.scope && authDetails.scope.length > 0 && (
          <div>
            <strong>Requested permissions:</strong>
            <ul>
              {authDetails.scope.split(" ").map((scopeItem) => (
                <li key={scopeItem}>{scopeItem}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <button onClick={handleApprove}>Approve</button>
        <button onClick={handleDeny}>Deny</button>
      </div>
    </div>
  );
}

OAuthConsentPage.path = "/oauth/consent";

/**
 * copied from @supabase/auth-js/src/lib/types.ts
 * to avoid adding a hard import to a Supabase package
 * because this page can also be used with FakeRest
 */
type OAuthAuthorizationDetails = {
  /** The authorization ID */
  authorization_id: string;
  /** Redirect URL - present if user already consented (can be used to trigger immediate redirect) */
  redirect_uri?: string;
  /** User object associated with the authorization */
  /** OAuth client requesting authorization */
  client: {
    /** Unique identifier for the OAuth client (UUID) */
    id: string;
    /** Human-readable name of the OAuth client */
    name: string;
    /** URI of the OAuth client's website */
    uri: string;
    /** URI of the OAuth client's logo */
    logo_uri: string;
  };
  user: {
    /** User ID (UUID) */
    id: string;
    /** User email */
    email: string;
  };
  /** Space-separated list of requested scopes */
  scope: string;
};
