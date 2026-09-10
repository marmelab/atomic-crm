import type { DataProvider, Identifier } from "ra-core";

import type { Contact, Deal, Offer } from "../types";
import {
  noopScholarshipCheckoutInvalidator,
  type InvalidateStaleCheckoutResult,
  type ScholarshipCheckoutInvalidator,
} from "./scholarshipCheckoutInvalidator";
import { buildStalePaymentOptionClear } from "./scholarshipSlotValidation";

export type GrantScholarshipPricingResult =
  | {
      status: "granted";
      staleCheckoutInvalidation: InvalidateStaleCheckoutResult;
    }
  | { status: "not-found" }
  | { status: "already-scholarship" }
  | { status: "already-won" }
  | { status: "no-scholarship-price-configured" }
  | { status: "slot-unavailable"; heldByDescription: string | null };

// The single domain function behind Leif explicitly granting scholarship
// pricing to a Deal (Scholarship Pricing + Capacity slice) — the ONLY way
// scholarship eligibility/price is ever established; the public Offer
// Page/browser can never grant itself this. Idempotent-via-refetch, same
// convention as every other domain function in this app: re-reads the
// current Deal rather than trusting the caller.
//
// Deliberately thin: the actual atomic slot-claim + commercial-snapshot-
// freezing happens inside the Postgres trigger handle_deal_saved() (or its
// FakeRest mirror, wired into providers/fakerest/dataProvider.ts) the
// instant this plain `pricing_mode` write lands — this function's own job
// is orchestrating that write, classifying its outcome into a typed
// result, and best-effort invalidating any stale Stripe Checkout Session
// for the OLD (standard) terms afterward. That invalidation is
// deliberately non-blocking (see scholarshipCheckoutInvalidator.ts) — its
// outcome is always reported on the result, never silently swallowed.
export const grantScholarshipPricing = async (
  dataProvider: DataProvider,
  dealId: Identifier,
  invalidateStaleCheckout: ScholarshipCheckoutInvalidator = noopScholarshipCheckoutInvalidator,
): Promise<GrantScholarshipPricingResult> => {
  const { data: deal } = await dataProvider
    .getOne<Deal>("deals", { id: dealId })
    .catch(() => ({ data: null as Deal | null }));
  if (!deal) return { status: "not-found" };
  if (deal.stage === "won") return { status: "already-won" };
  if (deal.pricing_mode === "scholarship")
    return { status: "already-scholarship" };

  const { data: offer } = await dataProvider.getOne<Offer>("offers", {
    id: deal.offer_id,
  });
  if (offer.scholarship_price == null) {
    return { status: "no-scholarship-price-configured" };
  }

  // A payment option selected while this Deal was standard is, by
  // definition, a standard-priced option — never valid once granted
  // scholarship. Clear it in the SAME write rather than leaving it to a
  // separate form edit: the DB's own cross-validation would otherwise
  // reject this exact write outright (see handle_deal_saved()'s payment-
  // option guard), turning "grant scholarship" into a confusing failure
  // whenever a standard option happens to already be selected.
  const staleOptionClear = await buildStalePaymentOptionClear(
    dataProvider,
    deal,
    "scholarship",
  );

  try {
    await dataProvider.update<Deal>("deals", {
      id: deal.id,
      // "Potential Value" (amount) follows the same rule
      // resolveOpportunityAmount.ts already establishes for the edit form
      // — never something left stale once the actual commercial terms are
      // known. Granting scholarship always clears any prior selected
      // option (above), so the known value is simply the frozen
      // scholarship price itself — never $0, never the old standard
      // amount (found via human acceptance: a real scholarship
      // Opportunity was showing "$0.00" on both the Kanban card and the
      // Opportunity lightbox because nothing kept this in sync).
      data: {
        pricing_mode: "scholarship",
        amount: offer.scholarship_price,
        ...staleOptionClear,
      },
      previousData: deal,
    });
  } catch (error) {
    if (!isSlotUnavailableError(error)) throw error;
    return {
      status: "slot-unavailable",
      heldByDescription: await describeCurrentHolder(
        dataProvider,
        deal.offer_id,
      ),
    };
  }

  const staleCheckoutInvalidation = await invalidateStaleCheckout(deal.id);
  return { status: "granted", staleCheckoutInvalidation };
};

const isSlotUnavailableError = (error: unknown): boolean =>
  error instanceof Error && /already held/i.test(error.message);

// Best-effort, read-only context for a clear rejection message — never
// throws; a failure here just means a slightly less specific message, not
// a broken grant flow.
const describeCurrentHolder = async (
  dataProvider: DataProvider,
  offerId: Identifier,
): Promise<string | null> => {
  try {
    const { data: slots } = await dataProvider.getList("scholarship_slots", {
      filter: { offer_id: offerId },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    const slot = slots[0];
    if (!slot) return null;

    if (slot.holder_deal_id != null) {
      const { data: holderDeal } = await dataProvider.getOne<Deal>("deals", {
        id: slot.holder_deal_id,
      });
      return `an outstanding scholarship offer to ${holderDeal.name}`;
    }
    if (slot.holder_enrollment_id != null) {
      const { data: enrollment } = await dataProvider.getOne("enrollments", {
        id: slot.holder_enrollment_id,
      });
      const { data: holderDeal } = await dataProvider.getOne<Deal>("deals", {
        id: enrollment.opportunity_id,
      });
      const { data: contact } = await dataProvider
        .getOne<Contact>("contacts", { id: holderDeal.contact_id! })
        .catch(() => ({ data: null as Contact | null }));
      return `a current scholarship client (${contact ? `${contact.first_name} ${contact.last_name}` : holderDeal.name})`;
    }
    return null;
  } catch {
    return null;
  }
};
