// Telling "your login has expired" apart from "the database said no".
//
// Both arrive as an HTTP 403, and the auth provider used to treat every
// one of them as a dead session. So when ending a sales attempt hit a
// missing grant on deal_outcome_events, the CRM did not show Leif an
// error — it signed him out and sent him to the Sign In page, twice, with
// a perfectly valid session.
//
// The grant is fixed at the source (20260919180000). This is the safety
// net: the NEXT missing grant, failed constraint or RLS refusal should be
// a visible error, not an ejection. Getting logged out teaches you
// nothing about what went wrong and loses whatever you were doing.
//
// The rule is narrow on purpose. A real auth failure still logs out:
//
//   401                          — the token is rejected. Always auth.
//   400 AuthSessionMissingError  — Supabase's "there is no session".
//   403 with no database code    — assume auth, as before.
//
// Only one case is reclassified: a 403 carrying a PostgreSQL SQLSTATE.
// Those are five alphanumeric characters (42501 permission denied, 42P01
// undefined table, 23514 check violation) and they can only come from the
// database having executed the request and refused it — which means the
// token was accepted and the session is alive. PostgREST's own codes are
// shaped differently (PGRST301 and friends, eight characters), so a JWT
// problem reported by PostgREST is not caught by this and still logs out.

/** Five alphanumerics: the shape of a PostgreSQL SQLSTATE. */
const SQLSTATE = /^[0-9A-Z]{5}$/;

type ErrorLike = {
  status?: number;
  name?: string;
  code?: unknown;
  body?: { code?: unknown } | null;
};

/** The database executed this request and refused it. */
export const isDatabaseError = (
  error: ErrorLike | null | undefined,
): boolean => {
  if (!error) return false;
  const code = error.body?.code ?? error.code;
  return typeof code === "string" && SQLSTATE.test(code);
};

/**
 * Should this error end the session?
 *
 * Returns true only for a genuine authentication failure. Everything else
 * — including a 403 the database produced — is the caller's problem to
 * report, not a reason to throw Leif out of the CRM.
 */
export const isSessionFailure = (
  error: ErrorLike | null | undefined,
): boolean => {
  if (!error) return false;
  const status = error.status;

  if (status === 401) return true;
  if (status === 400 && error.name === "AuthSessionMissingError") return true;
  if (status === 403) return !isDatabaseError(error);

  return false;
};
