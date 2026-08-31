import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslate } from "ra-core";
import type { Identifier } from "ra-core";
import { Button } from "@/components/ui/button";

import { AddToWaitlistSheet } from "./AddToWaitlistSheet";

// The obvious "+ Add to Waitlist" entry point (Waitlists slice, §9) shared
// by the Living Example, Group Program, and Cohort pages.
export const AddToWaitlistButton = ({
  offerId,
  cohortId,
}: {
  offerId: Identifier;
  cohortId: Identifier | null;
}) => {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {translate("resources.waitlist_entries.action.add", {
          _: "Add to Waitlist",
        })}
      </Button>
      <AddToWaitlistSheet
        open={open}
        onOpenChange={setOpen}
        offerId={offerId}
        cohortId={cohortId}
      />
    </>
  );
};
