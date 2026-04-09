import { ArrowUpRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useDataProvider, useNotify, useRefresh, useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";

import type { CrmDataProvider } from "../providers/types";
import type { IntakeLead } from "../types";

export const IntakePromoteButton = ({ record }: { record: IntakeLead }) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();
  const [isPending, setIsPending] = useState(false);
  const disabled =
    isPending || record.status === "qualified" || record.status === "rejected";

  const handlePromote = async () => {
    const crmDataProvider = dataProvider as CrmDataProvider & {
      promoteIntakeLead: (id: IntakeLead["id"]) => Promise<unknown>;
    };

    try {
      setIsPending(true);
      await crmDataProvider.promoteIntakeLead(record.id);
      notify("resources.intake_leads.notify.promoted", {
        type: "success",
        messageArgs: { _: "Intake lead promoted successfully" },
      });
      refresh();
    } catch (error) {
      notify("resources.intake_leads.notify.promote_failed", {
        type: "error",
        messageArgs: {
          _: error instanceof Error
            ? error.message
            : "Failed to promote intake lead",
        },
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        void handlePromote();
      }}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
      {isPending
        ? translate("resources.intake_leads.action.promoting", { _: "Promoting..." })
        : translate("resources.intake_leads.action.promote", { _: "Promote" })}
    </Button>
  );
};
