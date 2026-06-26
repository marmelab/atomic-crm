import { applyVerificationToEmails } from "./useVerifyContacts";
import type { EmailAndType, EmailVerificationResult } from "../types";

describe("applyVerificationToEmails", () => {
  const emails: EmailAndType[] = [
    { email: "a@x.com", type: "Work" },
    { email: "b@x.com", type: "Home" },
  ];

  it("merges verification onto the matching email only", () => {
    const results: EmailVerificationResult[] = [
      {
        email: "a@x.com",
        verification: { status: "Valid", checkedAt: "2026-06-26T00:00:00Z" },
      },
    ];

    const out = applyVerificationToEmails(emails, results);

    expect(out[0].verification?.status).toBe("Valid");
    expect(out[1].verification).toBeUndefined();
  });

  it("ignores results whose verification is null", () => {
    const results: EmailVerificationResult[] = [
      { email: "a@x.com", verification: null, error: "Verifier returned 502" },
    ];

    const out = applyVerificationToEmails(emails, results);

    expect(out[0].verification).toBeUndefined();
  });

  it("does not mutate the input", () => {
    const results: EmailVerificationResult[] = [
      {
        email: "a@x.com",
        verification: { status: "Invalid", checkedAt: "2026-06-26T00:00:00Z" },
      },
    ];

    const out = applyVerificationToEmails(emails, results);

    expect(out).not.toBe(emails);
    expect(emails[0].verification).toBeUndefined();
  });
});
