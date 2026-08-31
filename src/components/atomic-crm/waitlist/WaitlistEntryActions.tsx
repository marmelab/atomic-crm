import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { useDataProvider, useNotify, useRefresh, useTranslate } from "ra-core";
import type { Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { WaitlistEntryStatus } from "../types";
import { WaitlistEntryEditSheet } from "./WaitlistEntryEditSheet";
import {
  convertToOpportunity,
  markInvited,
  removeFromWaitlist,
} from "./waitlistActions";

// The operational actions for one active (waiting/invited) Waitlist Entry
// (Waitlists slice, §11/§12/§13) — every write goes through
// waitlistActions.ts; this component only orchestrates the click and the
// resulting notification/refresh. Never rendered for a converted/removed
// (historical) entry — those are read-only on ContactShow.
export const WaitlistEntryActions = ({
  entryId,
  status,
}: {
  entryId: Identifier;
  status: WaitlistEntryStatus;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const runInvite = async () => {
    setBusy(true);
    try {
      const result = await markInvited(dataProvider, entryId);
      notify(
        result.applied
          ? "resources.waitlist_entries.notifications.invited"
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

  const runConvert = async () => {
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
      } else {
        notify(
          result.reusedExisting
            ? "resources.waitlist_entries.notifications.converted_existing"
            : "resources.waitlist_entries.notifications.converted",
          { type: "info" },
        );
      }
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const runRemove = async () => {
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={busy}
            aria-label={translate("resources.waitlist_entries.actions.title", {
              _: "Waitlist entry actions",
            })}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            {translate("resources.waitlist_entries.actions.edit", {
              _: "Edit",
            })}
          </DropdownMenuItem>
          {status === "waiting" && (
            <DropdownMenuItem onClick={runInvite}>
              {translate("resources.waitlist_entries.actions.mark_invited", {
                _: "Mark Invited",
              })}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={runConvert}>
            {translate("resources.waitlist_entries.actions.convert", {
              _: "Convert to Opportunity",
            })}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={runRemove} variant="destructive">
            {translate("resources.waitlist_entries.actions.remove", {
              _: "Remove from Waitlist",
            })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <WaitlistEntryEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        entryId={entryId}
      />
    </>
  );
};
