import type { DataProvider, Identifier } from "ra-core";

import type {
  OfferPaymentOption,
  PricingMode,
  ScholarshipSlot,
} from "../types";

// Scholarship Pricing + Capacity slice: the FakeRest mirror of the
// Postgres-side scholarship-slot mechanism (handle_deal_saved()/
// handle_deal_won()/handle_enrollment_scholarship_slot_transition() in
// supabase/schemas/02_functions.sql) — same dual-implementation convention
// as offerCohortValidation.ts/waitlistEntryValidation.ts. FakeRest is
// single-threaded and sequential (no real races), so a plain read-then-
// write is sufficient there; the actual atomic, race-proof guarantee is
// the real Postgres trigger's `INSERT ... ON CONFLICT ... WHERE` — see
// that function's own comment. This file exists so demo/dev mode enforces
// the identical business rule, not to itself prove concurrency safety.

export class ScholarshipSlotUnavailableError extends Error {}
export class ScholarshipPricingModeError extends Error {}

const findScholarshipSlot = async (
  dataProvider: DataProvider,
  offerId: Identifier,
): Promise<ScholarshipSlot | null> => {
  const { data } = await dataProvider.getList<ScholarshipSlot>(
    "scholarship_slots",
    {
      filter: { offer_id: offerId },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
  );
  return data[0] ?? null;
};

const isFree = (slot: ScholarshipSlot | null): boolean =>
  !slot || (slot.holder_deal_id == null && slot.holder_enrollment_id == null);

const appendSlotEvent = async (
  dataProvider: DataProvider,
  event: {
    offerId: Identifier;
    dealId?: Identifier | null;
    enrollmentId?: Identifier | null;
    eventType:
      | "scholarship_granted"
      | "scholarship_released"
      | "deal_converted_to_enrollment"
      | "enrollment_completed_slot_released"
      | "slot_reclaimed_after_backward_lifecycle_correction";
  },
): Promise<void> => {
  await dataProvider.create("scholarship_slot_events", {
    data: {
      offer_id: event.offerId,
      deal_id: event.dealId ?? null,
      enrollment_id: event.enrollmentId ?? null,
      event_type: event.eventType,
      occurred_at: new Date().toISOString(),
    },
  });
};

// Atomic (in FakeRest's single-threaded sense) grant: claims this Offer's
// single scholarship slot for this Deal. Throws ScholarshipSlotUnavailableError
// if another Deal/Enrollment already holds it — never silently displaces
// a holder.
export const claimScholarshipSlotForDeal = async (
  dataProvider: DataProvider,
  { offerId, dealId }: { offerId: Identifier; dealId: Identifier },
): Promise<void> => {
  const slot = await findScholarshipSlot(dataProvider, offerId);
  if (!isFree(slot)) {
    throw new ScholarshipSlotUnavailableError(
      `Scholarship slot for offer ${offerId} is already held`,
    );
  }
  const reservedAt = new Date().toISOString();
  if (slot) {
    await dataProvider.update("scholarship_slots", {
      id: slot.id,
      data: { holder_deal_id: dealId, reserved_at: reservedAt },
      previousData: slot,
    });
  } else {
    await dataProvider.create("scholarship_slots", {
      data: {
        offer_id: offerId,
        holder_deal_id: dealId,
        reserved_at: reservedAt,
      },
    });
  }
  await appendSlotEvent(dataProvider, {
    offerId,
    dealId,
    eventType: "scholarship_granted",
  });
};

// Releases a slot this exact Deal currently holds. A safe no-op (matching
// the Postgres trigger's own guarantee) if this Deal isn't actually the
// current holder — the pre-Won immutability guard and the "only ever the
// genuine holder can reach this branch" invariant already make that the
// expected case in practice, not something this function needs to enforce
// itself.
export const releaseScholarshipSlotForDeal = async (
  dataProvider: DataProvider,
  { offerId, dealId }: { offerId: Identifier; dealId: Identifier },
): Promise<void> => {
  const slot = await findScholarshipSlot(dataProvider, offerId);
  if (!slot || String(slot.holder_deal_id ?? "") !== String(dealId)) return;

  await dataProvider.update("scholarship_slots", {
    id: slot.id,
    data: { holder_deal_id: null, reserved_at: null },
    previousData: slot,
  });
  await appendSlotEvent(dataProvider, {
    offerId,
    dealId,
    eventType: "scholarship_released",
  });
};

// Won transition: atomically (in FakeRest's sequential sense) hands the
// slot this Deal held over to its newly-created Enrollment — mirrors
// handle_deal_won()'s own single-UPDATE transition exactly.
export const transitionScholarshipSlotToEnrollment = async (
  dataProvider: DataProvider,
  {
    offerId,
    dealId,
    enrollmentId,
  }: { offerId: Identifier; dealId: Identifier; enrollmentId: Identifier },
): Promise<void> => {
  const slot = await findScholarshipSlot(dataProvider, offerId);
  if (!slot || String(slot.holder_deal_id ?? "") !== String(dealId)) {
    throw new ScholarshipPricingModeError(
      `Deal ${dealId} reached Won as scholarship but held no scholarship slot for offer ${offerId} — data inconsistency`,
    );
  }
  await dataProvider.update("scholarship_slots", {
    id: slot.id,
    data: { holder_deal_id: null, holder_enrollment_id: enrollmentId },
    previousData: slot,
  });
  await appendSlotEvent(dataProvider, {
    offerId,
    dealId,
    enrollmentId,
    eventType: "deal_converted_to_enrollment",
  });
};

// Enrollment completion: releases the slot this Enrollment holds, if any
// (a standard Enrollment never holds one, so this is a safe no-op for it).
export const releaseScholarshipSlotForEnrollment = async (
  dataProvider: DataProvider,
  { enrollmentId }: { enrollmentId: Identifier },
): Promise<void> => {
  const { data: slots } = await dataProvider.getList<ScholarshipSlot>(
    "scholarship_slots",
    {
      filter: { holder_enrollment_id: enrollmentId },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
  );
  const slot = slots[0];
  if (!slot) return;

  await dataProvider.update("scholarship_slots", {
    id: slot.id,
    data: { holder_enrollment_id: null },
    previousData: slot,
  });
  await appendSlotEvent(dataProvider, {
    offerId: slot.offer_id,
    enrollmentId,
    eventType: "enrollment_completed_slot_released",
  });
};

// Backward lifecycle correction off of "completed": attempts to reclaim
// the slot for this Enrollment's Offer. Throws ScholarshipSlotUnavailableError
// if another Deal/Enrollment has since claimed it — the correction must be
// rejected outright, never silently displacing another holder.
export const reclaimScholarshipSlotForEnrollment = async (
  dataProvider: DataProvider,
  { offerId, enrollmentId }: { offerId: Identifier; enrollmentId: Identifier },
): Promise<void> => {
  const slot = await findScholarshipSlot(dataProvider, offerId);
  if (!isFree(slot)) {
    throw new ScholarshipSlotUnavailableError(
      `Cannot reopen enrollment ${enrollmentId}: scholarship slot for offer ${offerId} is already held by another Deal/Enrollment`,
    );
  }
  const reservedAt = new Date().toISOString();
  if (slot) {
    await dataProvider.update("scholarship_slots", {
      id: slot.id,
      data: { holder_enrollment_id: enrollmentId, reserved_at: reservedAt },
      previousData: slot,
    });
  } else {
    await dataProvider.create("scholarship_slots", {
      data: {
        offer_id: offerId,
        holder_enrollment_id: enrollmentId,
        reserved_at: reservedAt,
      },
    });
  }
  await appendSlotEvent(dataProvider, {
    offerId,
    enrollmentId,
    eventType: "slot_reclaimed_after_backward_lifecycle_correction",
  });
};

// --- Deal-save validation guards (mirror handle_deal_saved()'s own raises) ---

export const assertScholarshipGrantedOnlyViaEdit = (
  isCreate: boolean,
  pricingMode: PricingMode | undefined,
): void => {
  if (isCreate && pricingMode === "scholarship") {
    throw new ScholarshipPricingModeError(
      "A new Opportunity cannot be created directly as scholarship — grant scholarship pricing via Deal edit after creation",
    );
  }
};

export const assertPricingModeImmutableOnceWon = (
  previousData: { stage?: string; pricing_mode?: PricingMode } | undefined,
  nextPricingMode: PricingMode | undefined,
  dealId: Identifier,
): void => {
  if (
    previousData?.stage === "won" &&
    nextPricingMode != null &&
    nextPricingMode !== previousData.pricing_mode
  ) {
    throw new ScholarshipPricingModeError(
      `Cannot change pricing_mode on deal ${dealId} once it has reached Won`,
    );
  }
};

export const assertNoOfferChangeWhileScholarship = (
  previousData:
    | { pricing_mode?: PricingMode; offer_id?: Identifier }
    | undefined,
  nextOfferId: Identifier | undefined,
  dealId: Identifier,
): void => {
  if (
    previousData?.pricing_mode === "scholarship" &&
    nextOfferId != null &&
    String(nextOfferId) !== String(previousData.offer_id)
  ) {
    throw new ScholarshipPricingModeError(
      `Cannot change offer_id on deal ${dealId} while it holds a scholarship reservation — release scholarship pricing first`,
    );
  }
};

export const assertPaymentOptionMatchesPricingMode = (
  option: { offer_id: Identifier; pricing_mode?: PricingMode },
  offerId: Identifier,
  pricingMode: PricingMode,
  dealId: Identifier | undefined,
  paymentOptionId: Identifier,
): void => {
  if (
    String(option.offer_id) !== String(offerId) ||
    (option.pricing_mode ?? "standard") !== pricingMode
  ) {
    throw new ScholarshipPricingModeError(
      `Payment option ${paymentOptionId} does not match deal ${dealId}'s offer/pricing_mode`,
    );
  }
};

// Shared by grantScholarshipPricing.ts/releaseScholarshipReservation.ts —
// NOT a FakeRest mirror (dataProvider-agnostic, used identically against
// either backend). A payment option selected under the OLD pricing_mode is,
// by definition, invalid under the new one — clearing it in the SAME write
// that changes pricing_mode avoids the DB's own cross-validation
// (assertPaymentOptionMatchesPricingMode / handle_deal_saved()'s mirror)
// rejecting the grant/release outright whenever a now-stale option happens
// to still be selected. Returns an empty object when there's nothing stale
// to clear, so a plain spread into the update payload is always safe.
export const buildStalePaymentOptionClear = async (
  dataProvider: DataProvider,
  deal: { selected_payment_option_id?: Identifier | null },
  nextPricingMode: PricingMode,
): Promise<
  Partial<{
    selected_payment_option_id: null;
    selected_payment_total: null;
    selected_installment_count: null;
    selected_installment_amount: null;
  }>
> => {
  if (deal.selected_payment_option_id == null) return {};

  const option = await dataProvider
    .getOne<OfferPaymentOption>("offer_payment_options", {
      id: deal.selected_payment_option_id,
    })
    .then(({ data }) => data)
    .catch(() => null);

  if (option && (option.pricing_mode ?? "standard") === nextPricingMode) {
    return {};
  }

  return {
    selected_payment_option_id: null,
    selected_payment_total: null,
    selected_installment_count: null,
    selected_installment_amount: null,
  };
};
