import type { DataProvider, Identifier } from "ra-core";

import type { Deal, Enrollment } from "../types";

export type RecordDealPaymentSucceededResult =
  | { status: "won"; enrollmentId: Identifier }
  // Idempotent: a duplicate/out-of-order/replayed payment-succeeded event
  // for a Deal already processed is a safe no-op, never a second Won
  // transition or a second Enrollment (Payment domain foundation slice —
  // mirrors cancelSalesCall.ts's own "already-cancelled" convention).
  | { status: "already-won"; enrollmentId: Identifier | null }
  | { status: "not-found" }
  // A real successful payment for an Opportunity someone already
  // explicitly exited (lost/DNE/workshops_only/...) is a genuine anomaly —
  // never silently overridden or dropped. Surfaced to the caller to log/
  // alert on, mirroring how this codebase never guesses a human decision
  // it wasn't given (see cancelSalesCall.ts's own restraint on stage).
  | { status: "outcome-conflict"; outcome: string };

// The single domain function behind "a real payment for this Deal just
// succeeded" — Payment domain foundation slice. First successful payment
// is the Won boundary (Leif's own explicit decision) — full installment-
// plan completion is NOT required.
//
// Deliberately does NOT create the Enrollment itself. Audited before
// writing this: an Opportunity's Enrollment is already created
// automatically, exactly at status "onboarding" with dates from its
// Cohort's own program dates, the instant deals.stage genuinely becomes
// 'won' — a real, already-deployed Postgres trigger
// (handle_deal_won()/on_deal_won, supabase/schemas/02_functions.sql +
// 04_triggers.sql, confirmed live and firing correctly against the real
// linked project during this slice's own verification) in production, and
// its FakeRest mirror (providers/fakerest/dataProvider.ts's own
// ensureEnrollmentForWonDeal) in dev/demo. Duplicating that here would
// have meant two independent "creates the Enrollment" code paths racing
// each other for no reason — this function's only remaining job is the
// idempotent stage transition itself, then handing back the id of the
// Enrollment the existing infrastructure already created. Both the real
// trigger and its FakeRest mirror are themselves idempotent (ON CONFLICT
// DO NOTHING / an existence check), so a duplicate/out-of-order call here
// is still fully safe even without this function's own "already-won"
// short-circuit — that check exists for a fast, cheap, informative
// no-op, not as the only safety net.
//
// Deliberately Stripe-agnostic: takes only a Deal id. The eventual Stripe
// integration slice is what calls this, after it has independently
// verified and persisted its own Stripe-specific fields — this function's
// only job is the CRM-side consequence of "payment succeeded", exactly
// the same separation bookSalesCall.ts keeps from the Acuity-specific
// fetch/match layer above it.
//
// Idempotent-via-refetch, same convention as reviewApplication.ts/
// cancelSalesCall.ts: re-reads the current Deal rather than trusting the
// caller, so a duplicate or out-of-order webhook delivery can never
// double-process.
//
// paymentOptionId, when provided, is the option the successful payment was
// actually for (resolveAuthorizedCheckoutTerms.ts's own read-only
// authorization already validated it before Checkout was ever created) —
// this is where the Deal's commercial snapshot gets frozen
// (selected_payment_option_id, via the existing handle_deal_saved()
// trigger), deliberately not any earlier: a prospect's in-progress choice
// must stay freely changeable across an abandoned/retried Checkout
// attempt, so freezing happens exactly when a payment actually succeeds,
// never before. A no-op if the Deal already has this exact option set
// (e.g. Leif pre-authorized it, or a duplicate webhook delivery).
export const recordDealPaymentSucceeded = async (
  dataProvider: DataProvider,
  dealId: Identifier,
  { paymentOptionId }: { paymentOptionId?: Identifier } = {},
): Promise<RecordDealPaymentSucceededResult> => {
  const { data: deal } = await dataProvider
    .getOne<Deal>("deals", { id: dealId })
    .catch(() => ({ data: null as Deal | null }));
  if (!deal) return { status: "not-found" };

  if (deal.stage === "won") {
    const existing = await findEnrollment(dataProvider, deal.id);
    return { status: "already-won", enrollmentId: existing?.id ?? null };
  }

  if (deal.outcome != null) {
    return { status: "outcome-conflict", outcome: deal.outcome };
  }

  const needsOptionFreeze =
    paymentOptionId != null &&
    String(deal.selected_payment_option_id ?? "") !== String(paymentOptionId);

  await dataProvider.update<Deal>("deals", {
    id: deal.id,
    data: {
      stage: "won",
      ...(needsOptionFreeze
        ? { selected_payment_option_id: paymentOptionId }
        : {}),
    },
    previousData: deal,
  });

  // The trigger/hook above already created the Enrollment, synchronously,
  // within the same write this function just awaited — safe to read back
  // immediately, no polling/retry needed.
  const enrollment = await findEnrollment(dataProvider, deal.id);
  if (!enrollment) {
    throw new Error(
      `Deal ${deal.id} reached Won but no Enrollment was found — the handle_deal_won() trigger (or its FakeRest mirror) may be missing or disabled.`,
    );
  }
  return { status: "won", enrollmentId: enrollment.id };
};

const findEnrollment = async (
  dataProvider: DataProvider,
  opportunityId: Identifier,
): Promise<Enrollment | null> => {
  const { data } = await dataProvider.getList<Enrollment>("enrollments", {
    filter: { opportunity_id: opportunityId },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  return data[0] ?? null;
};
