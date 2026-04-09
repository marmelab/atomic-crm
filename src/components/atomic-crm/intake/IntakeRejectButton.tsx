import { X } from "lucide-react";
import { useNotify, useRefresh, useTranslate, useUpdate } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { IntakeLead } from "../types";

export const INTAKE_REJECTION_REASONS = [
  "Not a fit",
  "Duplicate",
  "No contact info",
  "Out of area",
  "Other",
] as const;

const REJECTION_REASON_KEYS: Record<string, string> = {
  "Not a fit": "not_a_fit",
  "Duplicate": "duplicate",
  "No contact info": "no_contact_info",
  "Out of area": "out_of_area",
  "Other": "other",
};

export const IntakeRejectButton = ({ record }: { record: IntakeLead }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();
  const [update, { isPending }] = useUpdate();
  const disabled =
    isPending || record.status === "qualified" || record.status === "rejected";

  const handleReject = (reason: string) => {
    update(
      "intake_leads",
      {
        id: record.id,
        data: {
          status: "rejected",
          rejection_reason: reason,
        },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify("resources.intake_leads.notify.rejected", {
            type: "success",
            messageArgs: { _: "Intake lead rejected" },
          });
          refresh();
        },
        onError: (error) => {
          notify("resources.intake_leads.notify.reject_failed", {
            type: "error",
            messageArgs: {
              _: error instanceof Error
                ? error.message
                : "Failed to reject intake lead",
            },
          });
        },
      },
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="border-destructive/40 text-destructive hover:text-destructive"
          onClick={(event) => event.stopPropagation()}
        >
          <X className="size-4" />
          {translate("resources.intake_leads.action.reject", { _: "Reject" })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {INTAKE_REJECTION_REASONS.map((reason) => (
          <DropdownMenuItem
            key={reason}
            className="cursor-pointer"
            onSelect={() => handleReject(reason)}
          >
            {translate(
              `resources.intake_leads.rejection_reasons.${REJECTION_REASON_KEYS[reason]}`,
              { _: reason },
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
