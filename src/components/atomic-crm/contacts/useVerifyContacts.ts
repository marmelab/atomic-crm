import { useCallback, useState } from "react";
import { useDataProvider, useUpdate } from "ra-core";

import type { CrmDataProvider } from "../providers/types";
import type { Contact, EmailAndType, EmailVerificationResult } from "../types";

// ~28 verifications/min — stays under MyEmailVerifier's 30 req/min cap.
export const RATE_LIMIT_DELAY_MS = 2100;

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Merge verification results back into a contact's email list by email address.
// Pure — safe to unit test and reuse from the import path.
export const applyVerificationToEmails = (
  emails: EmailAndType[],
  results: EmailVerificationResult[],
): EmailAndType[] => {
  const byEmail = new Map(
    results
      .filter((result) => result.verification)
      .map((result) => [result.email, result.verification!]),
  );
  return emails.map((entry) =>
    byEmail.has(entry.email)
      ? { ...entry, verification: byEmail.get(entry.email) }
      : entry,
  );
};

// Shared hook used by the single-contact and bulk verify buttons. Verifies each
// contact's emails through MyEmailVerifier, persists results into email_jsonb,
// and throttles between contacts to respect the rate limit.
export function useVerifyContacts() {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [update] = useUpdate<Contact>("contacts", undefined, {
    returnPromise: true,
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [progress, setProgress] = useState(0);

  const verify = useCallback(
    async (contacts: Contact[]): Promise<number> => {
      setIsVerifying(true);
      setProgress(0);
      let verifiedCount = 0;
      try {
        for (let i = 0; i < contacts.length; i++) {
          const contact = contacts[i];
          const emails = contact.email_jsonb ?? [];
          const addresses = emails.map((entry) => entry.email).filter(Boolean);

          if (addresses.length > 0) {
            const results = await dataProvider.verifyEmails(addresses);
            const updatedEmails = applyVerificationToEmails(emails, results);
            await update("contacts", {
              id: contact.id,
              data: { email_jsonb: updatedEmails },
              previousData: contact,
            });
            verifiedCount += results.filter((r) => r.verification).length;

            if (i < contacts.length - 1) {
              await sleep(RATE_LIMIT_DELAY_MS * addresses.length);
            }
          }
          setProgress(i + 1);
        }
      } finally {
        setIsVerifying(false);
        setProgress(0);
      }
      return verifiedCount;
    },
    [dataProvider, update],
  );

  return { verify, isVerifying, progress };
}
