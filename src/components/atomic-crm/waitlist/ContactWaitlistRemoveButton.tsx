import { useState } from "react";
import { useDataProvider, useNotify, useRefresh, useTranslate } from "ra-core";
import type { Identifier } from "ra-core";
import { Button } from "@/components/ui/button";

import { removeFromWaitlist } from "./waitlistActions";

// The Contact page's "Remove" action for one active (waiting/invited)
// Waitlist Entry. Mirrors ContactWaitlistConvertButton.tsx exactly and
// reuses the SAME centralized removeFromWaitlist domain action the
// Program/Cohort pages' WaitlistEntryActions.tsx already calls — never a
// second removal path, and never a delete: the entry transitions to
// Removed and stays visible on this list as history (with its removal
// date), so "they joined, then left" remains readable long after.
export const ContactWaitlistRemoveButton = ({
  entryId,
}: {
  entryId: Identifier;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const result = await removeFromWaitlist(dataProvider, entryId);
      notify(
        result.applied
          ? "resources.waitlist_entries.notifications.removed"
          : "resources.waitlist_entries.notifications.stale",
        { type: result.applied ? "info" : "warning" },
      );
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={handleClick}
    >
      {translate("resources.waitlist_entries.actions.remove", {
        _: "Remove",
      })}
    </Button>
  );
};
