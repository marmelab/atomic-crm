import { describe, expect, it } from "vitest";

import { isDatabaseError, isSessionFailure } from "./isSessionFailure";

// Leif was signed out twice, mid-action, with a perfectly valid session.
//
// Ending a sales attempt hit a missing grant on deal_outcome_events. The
// database refused it, PostgREST reported 403, and the auth provider read
// every 403 as "your login has expired" — so instead of an error message
// he got the Sign In page and lost what he was doing.
//
// The grant is fixed at the source. This is the rule that stops the next
// one looking like a logout, and it has to stay narrow: a real expired
// session must still end at Sign In.

describe("a real authentication failure still ends the session", () => {
  it("401 is always auth", () => {
    expect(isSessionFailure({ status: 401 })).toBe(true);
    // Even carrying a database-shaped code: 401 means the token itself
    // was rejected, so nothing below matters.
    expect(isSessionFailure({ status: 401, body: { code: "42501" } })).toBe(
      true,
    );
  });

  it("Supabase's missing-session 400 is auth", () => {
    expect(
      isSessionFailure({ status: 400, name: "AuthSessionMissingError" }),
    ).toBe(true);
  });

  it("a 403 with no database code is still treated as auth", () => {
    // Unchanged from the previous behaviour: without evidence the
    // database produced it, assume the session.
    expect(isSessionFailure({ status: 403 })).toBe(true);
    expect(isSessionFailure({ status: 403, body: {} })).toBe(true);
  });

  it("a PostgREST JWT complaint is not mistaken for a database error", () => {
    // PGRST301 is "JWT expired". Eight characters, not a SQLSTATE, so it
    // does not slip through the exemption.
    expect(isSessionFailure({ status: 403, body: { code: "PGRST301" } })).toBe(
      true,
    );
  });
});

describe("a business error does not masquerade as an expired session", () => {
  it("permission denied — the exact defect", () => {
    // What ending a sale produced: 42501 on deal_outcome_events.
    const error = {
      status: 403,
      body: {
        code: "42501",
        message: "permission denied for table deal_outcome_events",
      },
    };

    expect(isDatabaseError(error)).toBe(true);
    expect(isSessionFailure(error)).toBe(false);
  });

  it("an RLS refusal is a refusal, not a logout", () => {
    expect(isSessionFailure({ status: 403, body: { code: "42501" } })).toBe(
      false,
    );
  });

  it("a failed check constraint does not end the session", () => {
    expect(isSessionFailure({ status: 403, body: { code: "23514" } })).toBe(
      false,
    );
  });

  it("reads the code from the error itself when there is no body", () => {
    expect(isSessionFailure({ status: 403, code: "42P01" })).toBe(false);
  });
});

describe("everything else is left alone", () => {
  it("ordinary failures are not auth failures", () => {
    expect(isSessionFailure({ status: 500 })).toBe(false);
    expect(isSessionFailure({ status: 404 })).toBe(false);
    expect(isSessionFailure({ status: 400 })).toBe(false);
    expect(isSessionFailure(null)).toBe(false);
    expect(isSessionFailure(undefined)).toBe(false);
  });

  it("only a five-character SQLSTATE counts as a database error", () => {
    expect(isDatabaseError({ body: { code: "42501" } })).toBe(true);
    expect(isDatabaseError({ body: { code: "PGRST116" } })).toBe(false);
    expect(isDatabaseError({ body: { code: "oops" } })).toBe(false);
    expect(isDatabaseError({ body: { code: 42501 } })).toBe(false);
    expect(isDatabaseError({})).toBe(false);
  });
});
