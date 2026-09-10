import { useState } from "react";
import {
  useDataProvider,
  useGetOne,
  useNotify,
  useRecordContext,
  useRefresh,
} from "ra-core";
import { Button } from "@/components/ui/button";

import { useScholarshipCheckoutInvalidator } from "./ScholarshipCheckoutInvalidatorContext";
import { grantScholarshipPricing } from "./grantScholarshipPricing";
import { releaseScholarshipReservation } from "./releaseScholarshipReservation";
import type { Deal, Offer } from "../types";

// Scholarship Pricing + Capacity slice: granting/releasing scholarship
// pricing is a business EVENT, not passive Deal metadata — same precedent
// DealSalesProcessInputs.tsx's own header comment already establishes for
// owner_decision/prospect_decision. A plain form field bound to
// pricing_mode would bypass the atomic slot-claim/release entirely — this
// control always goes through grantScholarshipPricing.ts/
// releaseScholarshipReservation.ts instead of the generic Deal edit form's
// own save.
//
// Human-acceptance repair: the first version gave this its own full-width
// bordered card, which read as if scholarship were a normal, everyday
// Opportunity step rather than the occasional exception Leif herself
// controls. Deliberately quiet now — one small metadata-row item, same
// text-xs-label/text-sm-value shape as every other compact field on this
// page (source, entry_path, payment option), with a link-styled action
// rather than a solid/outline button. Still unambiguous when active (the
// small "Scholarship" badge next to the Offer name, set by DealShow.tsx,
// is the actual "this is exceptional" signal — this control is just where
// the action lives).
export const ScholarshipPricingControl = () => {
  const record = useRecordContext<Deal>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const invalidateStaleCheckout = useScholarshipCheckoutInvalidator();
  const [isPending, setIsPending] = useState(false);

  const { data: offer } = useGetOne<Offer>(
    "offers",
    { id: record?.offer_id },
    { enabled: record?.offer_id != null },
  );

  if (!record || record.stage === "won") return null;

  const isScholarship = record.pricing_mode === "scholarship";
  // Nothing to offer if this Offer has no scholarship price configured —
  // never invite a grant attempt that can only fail.
  if (!isScholarship && offer?.scholarship_price == null) return null;

  const handleGrant = async () => {
    setIsPending(true);
    try {
      const result = await grantScholarshipPricing(
        dataProvider,
        record.id,
        invalidateStaleCheckout,
      );
      if (result.status === "granted") {
        notify("Scholarship pricing granted.", { type: "success" });
      } else if (result.status === "slot-unavailable") {
        notify(
          `Scholarship slot unavailable${result.heldByDescription ? ` — held by ${result.heldByDescription}` : ""}.`,
          { type: "warning" },
        );
      } else if (result.status === "no-scholarship-price-configured") {
        notify("This Offer has no scholarship price configured.", {
          type: "warning",
        });
      } else {
        notify("Could not grant scholarship pricing.", { type: "warning" });
      }
      refresh();
    } finally {
      setIsPending(false);
    }
  };

  const handleRelease = async () => {
    setIsPending(true);
    try {
      const result = await releaseScholarshipReservation(
        dataProvider,
        record.id,
        invalidateStaleCheckout,
      );
      if (result.status === "released") {
        notify("Scholarship pricing released.", { type: "success" });
      } else {
        notify("Could not release scholarship pricing.", { type: "warning" });
      }
      refresh();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col mr-10">
      <span className="text-xs text-muted-foreground tracking-wide">
        Scholarship
      </span>
      {isScholarship ? (
        <Button
          size="sm"
          variant="link"
          className="h-auto p-0 justify-start text-sm"
          disabled={isPending}
          onClick={handleRelease}
        >
          Release scholarship
        </Button>
      ) : (
        <Button
          size="sm"
          variant="link"
          className="h-auto p-0 justify-start text-sm text-muted-foreground"
          disabled={isPending}
          onClick={handleGrant}
        >
          Grant (${offer?.scholarship_price})
        </Button>
      )}
    </div>
  );
};
