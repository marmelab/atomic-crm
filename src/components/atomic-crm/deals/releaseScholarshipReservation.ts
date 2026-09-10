import type { DataProvider, Identifier } from "ra-core";

import type { Deal, Offer } from "../types";
import {
  noopScholarshipCheckoutInvalidator,
  type InvalidateStaleCheckoutResult,
  type ScholarshipCheckoutInvalidator,
} from "./scholarshipCheckoutInvalidator";
import { buildStalePaymentOptionClear } from "./scholarshipSlotValidation";

export type ReleaseScholarshipReservationResult =
  | {
      status: "released";
      staleCheckoutInvalidation: InvalidateStaleCheckoutResult;
    }
  | { status: "not-found" }
  | { status: "not-scholarship" }
  | { status: "already-won" };

// The reverse of grantScholarshipPricing.ts — Leif explicitly reverting an
// outstanding (unpaid) scholarship Deal back to standard pricing. Only
// valid pre-Won (the DB trigger/FakeRest mirror already refuses a
// pricing_mode change once Won — see handle_deal_saved()'s own
// immutability guard); "already-won" here means "there is nothing left to
// release", not a genuine error.
export const releaseScholarshipReservation = async (
  dataProvider: DataProvider,
  dealId: Identifier,
  invalidateStaleCheckout: ScholarshipCheckoutInvalidator = noopScholarshipCheckoutInvalidator,
): Promise<ReleaseScholarshipReservationResult> => {
  const { data: deal } = await dataProvider
    .getOne<Deal>("deals", { id: dealId })
    .catch(() => ({ data: null as Deal | null }));
  if (!deal) return { status: "not-found" };
  if (deal.pricing_mode !== "scholarship") return { status: "not-scholarship" };
  if (deal.stage === "won") return { status: "already-won" };

  // See grantScholarshipPricing.ts's identical comment — a scholarship-only
  // option selected before release is invalid once standard again.
  const staleOptionClear = await buildStalePaymentOptionClear(
    dataProvider,
    deal,
    "standard",
  );

  // "Potential Value" (amount) follows the offer's current standard price
  // once released, for the same reason grantScholarshipPricing.ts sets it
  // to the scholarship price — never left stale at the old frozen amount.
  const { data: offer } = await dataProvider.getOne<Offer>("offers", {
    id: deal.offer_id,
  });

  await dataProvider.update<Deal>("deals", {
    id: deal.id,
    data: {
      pricing_mode: "standard",
      amount: offer.current_price,
      ...staleOptionClear,
    },
    previousData: deal,
  });

  const staleCheckoutInvalidation = await invalidateStaleCheckout(deal.id);
  return { status: "released", staleCheckoutInvalidation };
};
