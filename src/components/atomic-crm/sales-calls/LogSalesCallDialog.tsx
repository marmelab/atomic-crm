import { useState } from "react";
import { useDataProvider, useNotify, useRefresh, useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { Identifier } from "ra-core";
import { bookSalesCall } from "./bookSalesCall";

// Human-acceptance repair pass, §Repair 2: recovery action for a legacy/
// inconsistent Opportunity — a Call Booked (or later) stage with no
// sales_calls record behind it (Judy Holloway's fixture predated the
// entity; a real record could end up the same way from a data import or a
// manual stage edit). This does NOT fabricate historical event data —
// Leif enters the real date the call happened/was scheduled for, and this
// calls the same bookSalesCall domain service the Acuity boundary uses,
// so the resulting Sales Call is a genuine (if backfilled) record, not a
// silent guess. source: "manual" makes that provenance explicit.
export const LogSalesCallDialog = ({
  open,
  onOpenChange,
  contactId,
  contactName,
  opportunityId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: Identifier;
  contactName: string;
  opportunityId: Identifier;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [scheduledAt, setScheduledAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) setScheduledAt("");
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!scheduledAt || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await bookSalesCall({
        dataProvider,
        contactId,
        contactName,
        opportunityId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        source: "manual",
      });
      notify("resources.deals.sales_call.logged", {
        type: "info",
        _: "Sales call logged.",
      });
      handleOpenChange(false);
      refresh();
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate("resources.deals.sales_call.log_title", {
              _: "Log Sales Call",
            })}
          </DialogTitle>
          <DialogDescription>
            {translate("resources.deals.sales_call.log_description", {
              _: "This Opportunity reached Call Booked before call tracking existed. Enter when %{name}'s call actually happened (or is scheduled) to continue.",
              name: contactName,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="log-sales-call-date" className="text-sm font-medium">
            {translate("resources.deals.sales_call.scheduled_at", {
              _: "Call date",
            })}
          </Label>
          <Input
            id="log-sales-call-date"
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            {translate("ra.action.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!scheduledAt || isSubmitting}
          >
            {translate("resources.deals.sales_call.log_action", {
              _: "Log Sales Call",
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
