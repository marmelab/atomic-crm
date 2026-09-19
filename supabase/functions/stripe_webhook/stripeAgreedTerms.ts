// When a Stripe plan PROVES what was agreed, and when it does not.
//
// Emma Wijns is the case this exists for. Leif created her plan by hand in
// Stripe, the reconciler found the Subscription Schedule and linked it, and
// her Opportunity still read "Agreed terms not recorded · $0.00 collected"
// — because linking a plan object and knowing the agreed total were never
// connected. The schedule says, in Stripe's own data, $1,000 a month from
// 1 November to 1 March. That is four payments and four thousand dollars,
// and nobody had to guess any of it.
//
// The rules below are deliberately narrow, because "a subscription exists"
// is not the same claim as "this is what they agreed to pay":
//
//   FINITE. Every phase must end — by its own iteration count, or by an
//   end date a whole number of intervals after its start. An open-ended
//   monthly subscription proves a rate, never a total.
//
//   PRICED. Every phase must have a readable unit amount and a simple
//   recurring interval. A phase billing every 3 months, or with several
//   line items, is refused rather than approximated.
//
//   UNCONTESTED. Money already collected outside the schedule makes the
//   commitment ambiguous — a deposit plus a plan might be the agreement,
//   or the plan alone might be. Daniel Alexander is exactly that: $500
//   taken, then six months of $583 arranged. $3,498 and $3,998 are both
//   defensible readings, so this refuses and leaves it to Leif.
//
// Refusing is a real answer here. The CRM saying it does not know is worth
// more than a number nobody agreed to.

export type SchedulePhaseFacts = {
  /** Unit amount in minor units, per interval. */
  amountMinor: number | null;
  interval: string | null;
  /** Stripe's own interval multiplier; anything but 1 is refused. */
  intervalCount: number | null;
  iterations: number | null;
  startDate: number | null;
  endDate: number | null;
};

export type DerivedAgreedTerms = {
  totalMinor: number;
  installmentCount: number;
  /** Only when every installment is the same size. */
  installmentAmountMinor: number | null;
};

export type DerivationRefusal = {
  reason: string;
};

const SECONDS_PER_DAY = 86400;

/**
 * How many whole intervals fit between two instants, or null.
 *
 * Exact or nothing: a phase running from the 1st to the 15th is not
 * "about two weeks", it is something this cannot count, and a total built
 * on a rounded count would be wrong by an installment.
 */
export const intervalsBetween = (
  startSec: number,
  endSec: number,
  interval: string,
): number | null => {
  if (!(endSec > startSec)) return null;
  const start = new Date(startSec * 1000);
  const end = new Date(endSec * 1000);

  if (interval === "month" || interval === "year") {
    // The clock time must line up, or the phase does not end on a
    // billing boundary and the count is not a count.
    if (
      start.getUTCDate() !== end.getUTCDate() ||
      start.getUTCHours() !== end.getUTCHours() ||
      start.getUTCMinutes() !== end.getUTCMinutes() ||
      start.getUTCSeconds() !== end.getUTCSeconds()
    ) {
      return null;
    }
    const months =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - start.getUTCMonth());
    if (interval === "month") return months > 0 ? months : null;
    return months > 0 && months % 12 === 0 ? months / 12 : null;
  }

  const seconds = endSec - startSec;
  const unit =
    interval === "week"
      ? SECONDS_PER_DAY * 7
      : interval === "day"
        ? SECONDS_PER_DAY
        : null;
  if (unit == null) return null;
  if (seconds % unit !== 0) return null;
  const count = seconds / unit;
  return count > 0 ? count : null;
};

/** How many payments one phase makes, or null when it is not finite. */
export const phaseInstallments = (phase: SchedulePhaseFacts): number | null => {
  if (phase.intervalCount != null && phase.intervalCount !== 1) return null;
  if (phase.iterations != null) {
    return Number.isInteger(phase.iterations) && phase.iterations > 0
      ? phase.iterations
      : null;
  }
  if (phase.startDate == null || phase.endDate == null) return null;
  if (phase.interval == null) return null;
  return intervalsBetween(phase.startDate, phase.endDate, phase.interval);
};

/**
 * The agreed total a schedule proves, or the reason it proves none.
 *
 * `collectedMinor` is money the CRM already holds for this Opportunity.
 * Any of it is enough to refuse: see the comment at the top of the file.
 */
export const deriveAgreedTerms = (
  phases: SchedulePhaseFacts[],
  collectedMinor: number,
): DerivedAgreedTerms | DerivationRefusal => {
  if (phases.length === 0) return { reason: "the plan has no phases" };
  if (collectedMinor > 0) {
    return {
      reason: "money was collected outside this plan, so the total is unclear",
    };
  }

  let totalMinor = 0;
  let installmentCount = 0;
  const amounts = new Set<number>();

  for (const phase of phases) {
    if (phase.amountMinor == null || phase.amountMinor <= 0) {
      return { reason: "a phase has no readable amount" };
    }
    const count = phaseInstallments(phase);
    if (count == null) {
      return { reason: "the plan does not say when it ends" };
    }
    totalMinor += phase.amountMinor * count;
    installmentCount += count;
    amounts.add(phase.amountMinor);
  }

  if (totalMinor <= 0) return { reason: "the plan totals nothing" };

  return {
    totalMinor,
    installmentCount,
    installmentAmountMinor: amounts.size === 1 ? [...amounts][0] : null,
  };
};

export const isRefusal = (
  value: DerivedAgreedTerms | DerivationRefusal,
): value is DerivationRefusal =>
  (value as DerivationRefusal).reason !== undefined;
