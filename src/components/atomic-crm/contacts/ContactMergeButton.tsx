import { Merge } from "lucide-react";
import { useRecordContext, useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import type { Contact } from "../types";
import {
  CONTACT_MERGE_DISABLED_MESSAGE,
  CONTACT_MERGE_ENABLED,
} from "./contactSafety";

// The merge dialog used to collect a target contact and then call an
// endpoint that repointed three tables and deleted the loser, taking its
// sales calls, client sessions, Stripe identities and waitlist entries
// with it. The dialog is gone rather than disabled-in-place: offering to
// pick a target for an operation that cannot run is its own kind of lie.
//
// The button itself stays, disabled, and says why. A person who came here
// to merge two records needs to know the operation exists and is
// deliberately unavailable — not find that it quietly vanished.

export const ContactMergeButton = () => {
  const translate = useTranslate();
  const record = useRecordContext<Contact>();

  if (!record) return null;

  if (CONTACT_MERGE_ENABLED) {
    // Re-enabled only alongside a merge that moves every dependent table
    // in one transaction. Until then there is nothing to render here.
    throw new Error("Contact merge has no implementation to enable.");
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" className="h-6" size="sm" disabled>
        <Merge className="w-4 h-4" />
        {translate("resources.contacts.merge.action", {
          _: "Merge with another contact",
        })}
      </Button>
      <p className="text-xs text-muted-foreground max-w-72">
        {CONTACT_MERGE_DISABLED_MESSAGE}
      </p>
    </div>
  );
};
