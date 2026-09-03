// Shared test cases for computeRecoveryRedirectHash (src/authRecoveryRedirect.ts)
// and its static hand-mirror (index.html's inline <script>). Both
// authRecoveryRedirect.test.ts and authRecoveryRedirect.mirrorCheck.test.ts
// run the SAME cases against their respective implementation, so a future
// change to one that isn't mirrored to the other fails a test instead of
// silently drifting — see authRecoveryRedirect.ts's own comment for why
// this mirroring exists at all.
export type RecoveryRedirectCase = {
  name: string;
  hash: string;
  expected: string | null;
};

export const recoveryRedirectCases: RecoveryRedirectCase[] = [
  {
    name: "real recovery callback shape",
    hash: "#access_token=abc.def.ghi&expires_at=1&expires_in=3600&refresh_token=xyz&sb=&token_type=bearer&type=recovery",
    expected:
      "/set-password?access_token=abc.def.ghi&expires_at=1&expires_in=3600&refresh_token=xyz&sb=&token_type=bearer&type=recovery",
  },
  {
    name: "invite callback shape",
    hash: "#access_token=abc.def.ghi&refresh_token=xyz&type=invite",
    expected:
      "/set-password?access_token=abc.def.ghi&refresh_token=xyz&type=invite",
  },
  {
    name: "not a recovery/invite callback — an ordinary app route",
    hash: "#/apply/living-example",
    expected: null,
  },
  {
    name: "not a recovery/invite callback — the default post-login route",
    hash: "#/login",
    expected: null,
  },
  {
    name: "empty hash",
    hash: "",
    expected: null,
  },
  {
    name: "access_token present but not a recovery/invite type (e.g. a normal magic-link sign-in)",
    hash: "#access_token=abc.def.ghi&refresh_token=xyz&type=magiclink",
    expected: null,
  },
  {
    name: "recovery type present but no access_token (malformed/incomplete callback)",
    hash: "#type=recovery",
    expected: null,
  },
];
