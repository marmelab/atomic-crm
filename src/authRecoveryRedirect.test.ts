import { describe, expect, it } from "vitest";
import { computeRecoveryRedirectHash } from "./authRecoveryRedirect";
import { recoveryRedirectCases } from "./authRecoveryRedirect.fixtures";

describe("computeRecoveryRedirectHash", () => {
  for (const { name, hash, expected } of recoveryRedirectCases) {
    it(name, () => {
      expect(computeRecoveryRedirectHash(hash)).toBe(expected);
    });
  }
});
