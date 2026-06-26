import { ShieldCheck } from "lucide-react";
import { useCallback } from "react";
import {
  useGetMany,
  useListContext,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import { Button } from "@/components/ui/button";

import type { Contact } from "../types";
import { useVerifyContacts } from "./useVerifyContacts";

export function BulkVerifyButton() {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const { verify, isVerifying, progress } = useVerifyContacts();
  const { onUnselectItems, selectedIds = [] } = useListContext<Contact>();

  const { data: selectedContacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: selectedIds },
    { enabled: selectedIds.length > 0 },
  );

  const handleVerify = useCallback(async () => {
    try {
      const verifiedCount = await verify(selectedContacts);
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
    }
  }, [verify, selectedContacts, notify, onUnselectItems, refresh]);

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
