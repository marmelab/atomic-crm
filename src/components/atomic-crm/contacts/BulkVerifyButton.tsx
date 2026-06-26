import { ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";
import {
  useDataProvider,
  useGetMany,
  useListContext,
  useNotify,
  useRefresh,
  useTranslate,
  useUpdate,
} from "ra-core";
import { Button } from "@/components/ui/button";

import type { CrmDataProvider } from "../providers/types";
import type { Contact, EmailAndType } from "../types";

// ~28 verifications/min — stays under MyEmailVerifier's 30 req/min cap.
const RATE_LIMIT_DELAY_MS = 2100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function BulkVerifyButton() {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [update] = useUpdate<Contact>("contacts", undefined, {
    returnPromise: true,
  });
  const { onUnselectItems, selectedIds = [] } = useListContext<Contact>();
  const [isVerifying, setIsVerifying] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: selectedContacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: selectedIds },
    { enabled: selectedIds.length > 0 },
  );

  const handleVerify = useCallback(async () => {
    setIsVerifying(true);
    setProgress(0);
    let verifiedCount = 0;
    try {
      for (let i = 0; i < selectedContacts.length; i++) {
        const contact = selectedContacts[i];
        const emails = contact.email_jsonb ?? [];
        const addresses = emails.map((entry) => entry.email).filter(Boolean);

        if (addresses.length > 0) {
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
          verifiedCount += byEmail.size;

          // Throttle before the next contact (skip after the last one).
          if (i < selectedContacts.length - 1) {
            await sleep(RATE_LIMIT_DELAY_MS * addresses.length);
          }
        }
        setProgress(i + 1);
      }

      notify("resources.contacts.bulk_verify.success", {
        type: "success",
        messageArgs: {
          _: "Verified emails for selected contacts",
          smart_count: verifiedCount,
        },
      });
      onUnselectItems();
      refresh();
    } catch (error) {
      notify("resources.contacts.bulk_verify.error", {
        type: "error",
        messageArgs: { _: "Bulk verification failed" },
      });
      console.error("Bulk verify failed:", error);
    } finally {
      setIsVerifying(false);
      setProgress(0);
    }
  }, [
    dataProvider,
    notify,
    onUnselectItems,
    refresh,
    selectedContacts,
    update,
  ]);

  if (!selectedIds.length) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9"
      onClick={handleVerify}
      disabled={isVerifying}
    >
      <ShieldCheck />
      {isVerifying
        ? translate("resources.contacts.bulk_verify.pending", {
            _: "Verifying %{progress}/%{total}…",
            progress,
            total: selectedContacts.length,
          })
        : translate("resources.contacts.bulk_verify.action", { _: "Verify" })}
    </Button>
  );
}
