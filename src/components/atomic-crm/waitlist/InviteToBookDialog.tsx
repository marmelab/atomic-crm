import { useState } from "react";
import { X } from "lucide-react";
import { useDataProvider, useNotify, useRefresh, useTranslate } from "ra-core";
import type { Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { humanizeCohortName } from "../cohorts/humanizeCohortName";
import type { WaitlistEntryRow } from "./useWaitlistEntries";
import { prepareInvitationBatch } from "./waitlistInvitations";

// Review step before a batch is created. Leif routinely invites 30-40
// people at once, so this is one confirmation over the whole group — never
// 37 individual dialogs — with the ability to drop somebody from the
// selection before confirming.
export const InviteToBookDialog = ({
  open,
  onOpenChange,
  offerId,
  offerName,
  cohortId,
  cohortName,
  selected,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: Identifier;
  offerName: string;
  cohortId: Identifier | null;
  cohortName?: string | null;
  selected: WaitlistEntryRow[];
  onConfirmed: () => void;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const [dropped, setDropped] = useState<Set<string>>(new Set());

  const remaining = selected.filter((row) => !dropped.has(String(row.entryId)));

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const { invitations } = await prepareInvitationBatch(dataProvider, {
        offerId,
        cohortId,
        entryIds: remaining.map((row) => row.entryId),
      });
      notify("resources.waitlist_entries.notifications.invitation_prepared", {
        type: "info",
        messageArgs: {
          smart_count: invitations.length,
          _: `Prepared ${invitations.length} invitation(s). Nothing has been emailed yet.`,
        },
      });
      setDropped(new Set());
      onConfirmed();
      onOpenChange(false);
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md gap-0 p-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-base font-semibold">
            {translate("resources.waitlist_entries.invite.title", {
              _: "Invite to Book",
            })}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1 border-b px-5 py-3 text-sm">
          <span className="text-xs text-muted-foreground">
            {translate("resources.offers.name", {
              _: "Program",
              smart_count: 1,
            })}
          </span>
          <span>{offerName}</span>
          {cohortName && (
            <span className="text-xs text-muted-foreground">
              {humanizeCohortName(cohortName, offerName)}
            </span>
          )}
          <span className="mt-2 text-xs text-muted-foreground">
            {translate("resources.waitlist_entries.invite.selected", {
              _: "Selected: %{smart_count} people",
              smart_count: remaining.length,
            })}
          </span>
        </div>

        <ul className="max-h-[45vh] divide-y overflow-y-auto">
          {remaining.map((row) => (
            <li
              key={row.entryId}
              className="flex items-center justify-between gap-3 px-5 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{row.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={translate("ra.action.remove", { _: "Remove" })}
                onClick={() =>
                  setDropped((current) =>
                    new Set(current).add(String(row.entryId)),
                  )
                }
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
          {remaining.length === 0 && (
            <li className="px-5 py-3 text-xs text-muted-foreground">
              {translate("resources.waitlist_entries.invite.none", {
                _: "Nobody selected.",
              })}
            </li>
          )}
        </ul>

        {/* Said plainly, because it is true until Gmail exists: this
            prepares the invitations, it does not email anyone. */}
        <p className="border-t px-5 py-2 text-xs text-muted-foreground">
          {translate("resources.waitlist_entries.invite.pre_delivery_note", {
            _: "Prepares the invitations. No email is sent yet.",
          })}
        </p>

        <DialogFooter className="border-t px-5 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {translate("ra.action.cancel", { _: "Cancel" })}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={busy || remaining.length === 0}
          >
            {translate("resources.waitlist_entries.invite.confirm", {
              _: "Invite to Book",
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
