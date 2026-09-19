// Whether a sales attempt is still being sold.
//
// Audit #2 found this rule written out by hand about nine times across the
// app and the Edge Functions, in three subtly different shapes: some
// checked the stage, some did not, and one checked only the outcome. They
// happened to agree on today's data, which is the most dangerous way for
// nine copies of a rule to behave.
//
// The authority is the SQL function public.deal_is_active(archived_at,
// stage, outcome). This is its TypeScript mirror, for the places that hold
// a Deal in memory and cannot ask the database. dealActivity.test.ts walks
// the whole stage x outcome x archived matrix and asserts the two agree on
// every combination, so a change to one without the other fails.
//
// An Opportunity is ONE sales attempt for ONE Offer:
//
//   outcome IS NULL      the attempt is running; stage says where it is
//   stage = 'won'        it succeeded, and selling is over
//   outcome IS NOT NULL  it ended, and the reason says how
//
// A terminal attempt is never silently reactivated. If the same person
// starts a genuinely new cycle for the same Offer, that is a new
// Opportunity beside the old one — which is exactly what the Notion
// recovery did for contact 110.

/** The stages a running sales attempt can occupy. */
export const ACTIVE_SALES_STAGES = [
  "interested",
  "application_received",
  "approved",
  "call_booked",
  "decision",
] as const;

export type ActiveSalesStage = (typeof ACTIVE_SALES_STAGES)[number];

/** Every stage the column is allowed to hold, legacy storage included. */
export const DEAL_STAGES = [
  ...ACTIVE_SALES_STAGES,
  "won",
  // Legacy storage only. Fourteen rows renamed from 'committed' that never
  // made a sale. The board's Onboarding column is synthetic and unrelated;
  // a database trigger refuses any new write of this value.
  "onboarding",
] as const;

export const LEGACY_PERSISTED_ONBOARDING_STAGE = "onboarding";

/**
 * Structural rather than `Pick<Deal, …>` on purpose. Callers hold Deals
 * from several sources — the data provider, an Edge Function row, a test
 * fixture — and narrowing `outcome` to the union here would force every
 * one of them to cast, which is how the nine copies started.
 */
export type DealActivityFields = {
  stage: string;
  outcome?: string | null;
  archived_at?: string | null;
};

/**
 * The canonical active-sales predicate.
 *
 * Mirrors public.deal_is_active exactly. `== null` is deliberate: it treats
 * an absent field the same way SQL's IS NULL does, so an object that simply
 * omits archived_at is not read as archived.
 */
export const isActiveOpportunity = (deal: DealActivityFields): boolean =>
  deal.archived_at == null && deal.stage !== "won" && deal.outcome == null;

/** A sales attempt that ended without being won. */
export const hasExited = (deal: DealActivityFields): boolean =>
  deal.outcome != null;

/**
 * Whether a stage may be written today.
 *
 * Won is reachable, because winning is a real transition. Legacy
 * onboarding is not: the database refuses it, and this lets the app say so
 * before the round trip rather than surfacing a constraint error.
 */
export const isWritableStage = (stage: string): boolean =>
  stage !== LEGACY_PERSISTED_ONBOARDING_STAGE &&
  (DEAL_STAGES as readonly string[]).includes(stage);
