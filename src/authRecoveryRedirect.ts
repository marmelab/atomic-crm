// Auth password-recovery/invite real-infrastructure repair: a Supabase
// recovery/invite email link redirects the browser to
// "<site_url>/#access_token=...&refresh_token=...&type=recovery&...", the
// legacy implicit-grant hash shape ra-supabase-core's own checkAuth/
// getUrlParams expects — but this app's HashRouter treats that same hash
// as an (unroutable) navigation target and replaces it with the default
// unauthenticated route before any of the app's own recovery-aware code
// (including @supabase/supabase-js's own detectSessionInUrl, which races
// the very same hash) ever gets a chance to read it. Reproduced against
// the real linked project: a fresh recovery link (generated via the Admin
// API, consumed exactly as a real click would) correctly lands the
// browser at the right origin, but showed Sign In instead of Set Password
// — the tokens were already gone by the time any React/router code ran.
//
// Fixed at the only point guaranteed to run before the app's module
// script: index.html's own inline <script>, which always executes before
// a `<script type="module">` that follows it in document order. This
// module is the pure, testable decision logic that script hand-mirrors —
// index.html is served verbatim (Vite doesn't process it as a JS module
// import target), the same "can't import from src/" constraint every Deno
// Edge Function and public/404.html already work around by hand-mirroring
// their own src/ reference implementation. Keep the two in sync by hand if
// either changes; authRecoveryRedirect.mirrorCheck.test.ts asserts they
// still agree.
//
// Given the raw `window.location.hash` (including its leading "#"),
// returns the hash to rewrite it to — a real, recognized app route
// ("/set-password") carrying the original tokens as its own query string
// — or null if this isn't a recovery/invite callback at all.
export const computeRecoveryRedirectHash = (hash: string): string | null => {
  if (
    hash.indexOf("access_token=") !== -1 &&
    (hash.indexOf("type=recovery") !== -1 || hash.indexOf("type=invite") !== -1)
  ) {
    return `/set-password?${hash.slice(1)}`;
  }
  return null;
};
