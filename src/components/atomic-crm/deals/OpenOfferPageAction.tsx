import { useRecordContext } from "ra-core";
import { Button } from "@/components/ui/button";

import type { Deal } from "../types";

// Payment domain foundation slice, human-acceptance repair: the
// personalized Offer Page (/#/offer/:token) has been reachable since that
// slice shipped, but nothing in the authenticated CRM ever surfaced it —
// found during Scholarship Pricing + Capacity human acceptance (Leif had
// no way to open a Committed Opportunity's Offer Page without already
// knowing its opaque token). Token PRESENCE is the existing, durable
// "this Opportunity has a personalized Offer Page" signal
// (offerPageToken.ts generates it once, at Committed, and never rotates
// it — see that file's own header) — deliberately not a new eligibility
// rule. Same quiet metadata-row placement as ScholarshipPricingControl.tsx;
// the raw token itself is never rendered as visible text, only used to
// build the href.
export const OpenOfferPageAction = () => {
  const record = useRecordContext<Deal>();
  if (!record?.offer_page_token) return null;

  const url = `${window.location.origin}/#/offer/${record.offer_page_token}`;

  return (
    <div className="flex flex-col mr-10">
      <span className="text-xs text-muted-foreground tracking-wide">
        Offer Page
      </span>
      <Button
        asChild
        size="sm"
        variant="link"
        className="h-auto p-0 justify-start text-sm"
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          Open Offer Page
        </a>
      </Button>
    </div>
  );
};
