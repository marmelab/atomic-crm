// @vitest-environment node
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyAcuitySignature } from "./acuitySignature";

// Live Acuity Connection slice. The reference value below is computed
// independently via Node's own `crypto` module (not by calling the
// function under test with itself) so this genuinely checks the HMAC-
// SHA256 algorithm and encoding match what Acuity's docs specify
// (developers.acuityscheduling.com/docs/webhooks: base64(HMAC-SHA256(raw
// body, API key)), header `x-acuity-signature`), not just internal
// self-consistency.
const API_KEY = "test-acuity-api-key";
const BODY = "action=scheduled&id=12345&calendarID=1&appointmentTypeID=67890";
const VALID_SIGNATURE = createHmac("sha256", API_KEY)
  .update(BODY)
  .digest("base64");

describe("verifyAcuitySignature", () => {
  it("accepts a correctly signed payload", async () => {
    await expect(
      verifyAcuitySignature(BODY, VALID_SIGNATURE, API_KEY),
    ).resolves.toBe(true);
  });

  it("rejects a tampered body against the original signature", async () => {
    const tamperedBody = BODY.replace("12345", "99999");
    await expect(
      verifyAcuitySignature(tamperedBody, VALID_SIGNATURE, API_KEY),
    ).resolves.toBe(false);
  });

  it("rejects the correct body signed with the wrong key", async () => {
    const wrongKeySignature = createHmac("sha256", "some-other-key")
      .update(BODY)
      .digest("base64");
    await expect(
      verifyAcuitySignature(BODY, wrongKeySignature, API_KEY),
    ).resolves.toBe(false);
  });

  it("rejects a missing signature header", async () => {
    await expect(verifyAcuitySignature(BODY, null, API_KEY)).resolves.toBe(
      false,
    );
  });

  it("rejects an empty-string signature header", async () => {
    await expect(verifyAcuitySignature(BODY, "", API_KEY)).resolves.toBe(false);
  });

  it("rejects a well-formed but incorrect signature of the same length", async () => {
    // Same length as a real base64 SHA-256 digest, so this exercises the
    // full constant-time comparison rather than an early length-mismatch
    // return.
    const sameLengthWrongSignature =
      VALID_SIGNATURE.slice(0, -4) +
      (VALID_SIGNATURE.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    await expect(
      verifyAcuitySignature(BODY, sameLengthWrongSignature, API_KEY),
    ).resolves.toBe(false);
  });
});
