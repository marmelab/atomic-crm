import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useNotify, useRefresh, useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";

import { syncYearTracking } from "./syncYearTracking";

// Refresh Year Tracking, then say what changed.
//
// Every end date and every opening on this page is derived from the `1:1s`
// weeks Leif marks in that calendar, so when he adds more weeks this is
// how the CRM finds out — and it reports whether the calendar now reaches
// far enough, because "8 of 12 session weeks scheduled" is the answer that
// sends him back to the calendar rather than leaving him wondering.
//
// Same visual language and same safety as the existing Sync Stripe
// control: no credential in the browser, and re-running it is a no-op
// rather than a second copy of the year.
export const SyncCalendarButton = ({
  lastSyncedAt,
  stillShortFor,
}: {
  lastSyncedAt?: string | null;
  // How many people still have no computable end because the calendar
  // stops too early. Reported after a sync so Leif learns immediately
  // whether it was enough.
  stillShortFor?: number;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [syncing, setSyncing] = useState(false);

  const run = async () => {
    setSyncing(true);
    const result = await syncYearTracking();
    setSyncing(false);

    if (result.status === "error") {
      notify(result.message, { type: "error" });
      return;
    }
    notify(
      translate("crm.programs.sync_calendar_done", {
        _: "Year Tracking synced: %{upserted} weeks read, %{assigned} session weeks added, %{renumbered} renumbered.",
        upserted: result.windowsUpserted,
        assigned: result.assignmentsCreated,
        renumbered: result.slotsRenumbered,
      }),
      { type: "info" },
    );
    if (result.slotsRetiredWithHistory > 0) {
      // A week left somebody's schedule while carrying a decision Leif
      // made about it. The row is kept, never deleted — but he should
      // know, because it is the one case the rebuild cannot settle alone.
      notify(
        translate("crm.programs.sync_calendar_retired", {
          _: "%{count} session weeks left a schedule while carrying your own notes. They are kept for you to review.",
          count: result.slotsRetiredWithHistory,
        }),
        { type: "warning" },
      );
    }
    if (stillShortFor && stillShortFor > 0) {
      notify(
        translate("crm.programs.sync_calendar_still_short", {
          _: "%{count} clients still have no end date — Year Tracking does not yet reach their twelfth session week.",
          count: stillShortFor,
        }),
        { type: "warning" },
      );
    }
    refresh();
  };

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={run}
        disabled={syncing}
      >
        <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
        {syncing
          ? translate("crm.programs.sync_calendar_running", {
              _: "Syncing…",
            })
          : translate("crm.programs.sync_calendar", { _: "Sync Calendar" })}
      </Button>
      {lastSyncedAt && (
        <span className="text-xs text-muted-foreground">
          {translate("crm.programs.sync_calendar_last", {
            _: "Last synced %{when}",
            when: new Date(lastSyncedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
          })}
        </span>
      )}
    </div>
  );
};
