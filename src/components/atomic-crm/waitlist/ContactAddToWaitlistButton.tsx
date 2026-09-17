import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslate, type Identifier } from "ra-core";
import { Button } from "@/components/ui/button";

import { ContactAddToWaitlistSheet } from "./ContactAddToWaitlistSheet";

// The Contact-page entry point into the existing Waitlist model. The
// Program/Cohort pages already had AddToWaitlistButton.tsx ("pick a
// person for THIS program"); this is the other direction ("pick a program
// for THIS person"), which had no entry point at all.
export const ContactAddToWaitlistButton = ({
  contactId,
}: {
  contactId: Identifier;
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
      <ContactAddToWaitlistSheet
        open={open}
        onOpenChange={setOpen}
        contactId={contactId}
      />
    </>
  );
};
