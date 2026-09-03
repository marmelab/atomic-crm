import { beforeAll, describe, expect, it } from "vitest";
import { recoveryRedirectCases } from "./authRecoveryRedirect.fixtures";

// Guards the exact drift class this slice's own real-infrastructure Auth
// audit exists to catch: index.html hand-mirrors src/authRecoveryRedirect.ts's
// computeRecoveryRedirectHash (index.html is served verbatim — Vite never
// treats it as a module import target, so the inline <script> can't import
// the module directly). This test fetches the actual served index.html,
// extracts its real inline <script>, runs it for real against the SAME
// cases authRecoveryRedirect.test.ts checks the canonical implementation
// with, and asserts they still agree. A future edit to one that isn't
// mirrored to the other fails here.
let indexHtml: string;
beforeAll(async () => {
  indexHtml = await fetch("/").then((response) => response.text());
});

// index.html has two inline <script> blocks by the time this repair
// shipped (the recovery-redirect shim is the second one, right before the
// module script) — match all script bodies and pick the one that actually
// references access_token, rather than assuming a fixed position.
const extractRecoveryScript = (html: string): string => {
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const recoveryScript = matches
    .map((match) => match[1])
    .find((body) => body.includes("access_token="));
  if (!recoveryScript) {
    throw new Error(
      "index.html: expected an inline <script> referencing access_token=",
    );
  }
  return recoveryScript;
};

const runShim = (hash: string): string | null => {
  let redirectedHash: string | null = null;
  const fakeWindow = {
    location: {
      get hash() {
        return hash;
      },
      set hash(value: string) {
        redirectedHash = value;
      },
    },
  };
  const runInlineScript = new Function(
    "window",
    extractRecoveryScript(indexHtml),
  );
  runInlineScript(fakeWindow);
  return redirectedHash;
};

describe("index.html mirrors src/authRecoveryRedirect.ts", () => {
  for (const { name, hash, expected } of recoveryRedirectCases) {
    it(name, () => {
      expect(runShim(hash)).toBe(expected);
    });
  }
});
