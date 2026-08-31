import { useState } from "react";
import { useDataProvider, useNotify, useRefresh, useTranslate } from "ra-core";
import type { Identifier } from "ra-core";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

import { convertToOpportunity } from "./waitlistActions";

// The Contact page's direct "Convert to Opportunity" action for one active
// (waiting/invited) Waitlist Entry (Human-acceptance repair pass, §3A/§7):
// reuses the SAME centralized convertToOpportunity domain action the
// Program/Cohort pages' WaitlistEntryActions.tsx already calls — never a
// second conversion path. On success it navigates straight to the
// resulting Opportunity, so the Contact-page detour the ticket flagged
// ("must navigate to Opportunities, New Opportunity, remember/search
// Sarah again") never has to happen at all going the other direction
// either. When multiple active entries exist, each gets its OWN button
// (rendered per-row by ContactWaitlists.tsx) — the click itself is the
// disambiguation, never a guess.
export const ContactWaitlistConvertButton = ({
  entryId,
}: {
  entryId: Identifier;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const result = await convertToOpportunity(dataProvider, entryId);
      if (!result.applied) {
        notify(
          result.reason === "do-not-engage"
            ? "resources.waitlist_entries.notifications.do_not_engage"
            : "resources.waitlist_entries.notifications.stale",
          { type: "warning" },
        );
        setBusy(false);
        refresh();
        return;
      }
      notify(
        result.reusedExisting
          ? "resources.waitlist_entries.notifications.converted_existing"
          : "resources.waitlist_entries.notifications.converted",
        { type: "info" },
      );
      navigate(`/deals/${result.dealId}/show`);
    } catch {
      notify("ra.notification.http_error", { type: "error" });
      setBusy(false);
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
      {translate("resources.waitlist_entries.actions.convert", {
        _: "Convert to Opportunity",
      })}
    </Button>
  );
};
