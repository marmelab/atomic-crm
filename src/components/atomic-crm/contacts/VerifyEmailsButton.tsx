import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useTranslate,
  useUpdate,
} from "ra-core";
import { Button } from "@/components/ui/button";

import type { CrmDataProvider } from "../providers/types";
import type { Contact, EmailAndType } from "../types";

// Verifies every email on the contact through MyEmailVerifier and persists
// the result back into `email_jsonb`. Lives in ContactAside so it has the
// full contact record (the per-email rows can't update the parent contact).
export const VerifyEmailsButton = () => {
  const contact = useRecordContext<Contact>();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate<Contact>("contacts", undefined, {
    returnPromise: true,
  });
  const [isVerifying, setIsVerifying] = useState(false);

  const emails = contact?.email_jsonb ?? [];
  const addresses = emails.map((entry) => entry.email).filter(Boolean);

  if (!contact || addresses.length === 0) return null;

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const results = await dataProvider.verifyEmails(addresses);
      const byEmail = new Map(
        results
          .filter((result) => result.verification)
          .map((result) => [result.email, result.verification!]),
      );

      const updatedEmails: EmailAndType[] = emails.map((entry) =>
        byEmail.has(entry.email)
          ? { ...entry, verification: byEmail.get(entry.email) }
          : entry,
      );

      await update("contacts", {
        id: contact.id,
        data: { email_jsonb: updatedEmails },
        previousData: contact,
      });

      notify("resources.contacts.verify_emails.success", {
        type: "success",
        messageArgs: { _: "Emails verified", smart_count: byEmail.size },
      });
      refresh();
    } catch (error) {
      notify("resources.contacts.verify_emails.error", {
        type: "error",
        messageArgs: { _: "Email verification failed" },
      });
      console.error("verifyEmails failed:", error);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleVerify}
      disabled={isVerifying}
      className="h-6 cursor-pointer"
    >
      <ShieldCheck className="w-4 h-4" />
      {isVerifying
        ? translate("resources.contacts.verify_emails.pending", {
            _: "Verifying…",
          })
        : translate("resources.contacts.verify_emails.action", {
            _: "Verify emails",
          })}
    </Button>
  );
};
