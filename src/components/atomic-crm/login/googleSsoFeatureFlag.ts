// Kill-switch for the Google Workspace SSO buttons on login/signup.
// The Supabase project currently has no SAML SSO provider registered
// (`GET /config/auth/sso/providers` returns an empty list), so clicking
// the button always fails. Set to true once the SAML flow is configured
// (see doc/src/content/docs/developers/sso.mdx) and the Supabase project
// has an SSO provider for the intended domain.
export const GOOGLE_SSO_ENABLED = false;
