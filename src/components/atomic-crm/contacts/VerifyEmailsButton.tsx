import { ShieldCheck } from "lucide-react";
import { useNotify, useRecordContext, useRefresh, useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";

import type { Contact } from "../types";
import { useVerifyContacts } from "./useVerifyContacts";

// Verifies every email on the contact through MyEmailVerifier and persists
// the result back into `email_jsonb`. Lives in ContactAside so it has the
// full contact record (the per-email rows can't update the parent contact).
export const VerifyEmailsButton = () => {
  const contact = useRecordContext<Contact>();
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const { verify, isVerifying } = useVerifyContacts();

  const addresses = (contact?.email_jsonb ?? [])
    .map((entry) => entry.email)
    .filter(Boolean);

  if (!contact || addresses.length === 0) return null;

  const handleVerify = async () => {
    try {
      const verifiedCount = await verify([contact]);
      notify("resources.contacts.verify_emails.success", {
        type: "success",
        messageArgs: { _: "Emails verified", smart_count: verifiedCount },
      });
      refresh();
    } catch (error) {
      notify("resources.contacts.verify_emails.error", {
        type: "error",
        messageArgs: { _: "Email verification failed" },
      });
      console.error("verifyEmails failed:", error);
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
