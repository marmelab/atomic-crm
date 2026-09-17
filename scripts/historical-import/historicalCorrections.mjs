// Two historical facts that arrive as explicit rulings rather than from any
// source system, and that the main per-person pass cannot express:
//
//   1. Commercial terms somebody actually agreed to, when they differ from
//      the Offer's standard pricing.
//   2. An enrollment that really happened and then really ended.
//
// Both are corrections in the strict sense: the person, their Contact and
// their Deal already exist and are already right. Nothing here creates a
// person, a Deal or an Application — a ruling about what someone paid, or
// about their leaving, is never evidence that they exist twice.
//
// Kept separate from gateA-full-import.mjs so the decisions are testable
// without the gitignored source data the generator loads.

import {
  insertHistoricalEnrollment,
  insertHistoricalEnrollmentStatusEvent,
  applyHistoricalDealCommercialTerms,
} from "./write.mjs";

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Reads a commercial arrangement off a ruling, or null when it states none.
 *
 * Both parts or neither: a total with no period has no schedule, and a
 * period with no total has no price. Filling in the missing half would put
 * a payment plan nobody agreed to on a real person's record, so a half-
 * stated ruling is an error rather than something to infer from.
 *
 * The per-payment amount is the ONLY derived value, and it is derived by
 * dividing the ruling's total — never multiplied up from it. That direction
 * is what makes it impossible for "$700 total over 4 months" to be recorded
 * as $700 per payment.
 */
export const commercialTermsFromRuling = (ruling) => {
  const total = ruling?.paymentTotal ?? null;
  const installments = ruling?.paymentPeriodMonths ?? null;
  if (total == null && installments == null) return null;
  if (total == null || installments == null) {
    throw new Error(
      `commercialTermsFromRuling: ruling for ${ruling?.name ?? "(unnamed)"} states only half a commercial arrangement (paymentTotal=${total}, paymentPeriodMonths=${installments}) — both are required, neither is inferable.`,
    );
  }
  if (!(total > 0) || !Number.isInteger(installments) || installments < 1) {
    throw new Error(
      `commercialTermsFromRuling: ruling for ${ruling?.name ?? "(unnamed)"} states an impossible arrangement (paymentTotal=${total}, paymentPeriodMonths=${installments}).`,
    );
  }
  return {
    total,
    installments,
    installmentAmount: round2(total / installments),
  };
};

/**
 * Does the target already record exactly these terms?
 *
 * Compared numerically because Postgres `numeric` arrives as a string, so
 * 700 and "700.00" are the same fact and must not read as a difference —
 * otherwise every run would "correct" an already-correct Deal forever.
 */
export const termsAlreadyCorrect = (currentTerms, pricingMode, terms) => {
  if (!currentTerms) return false;
  const num = (v) => (v == null ? null : Number(v));
  return (
    (currentTerms.pm ?? "standard") === pricingMode &&
    num(currentTerms.t) === (terms?.total ?? null) &&
    num(currentTerms.n) === (terms?.installments ?? null) &&
    num(currentTerms.a) === (terms?.installmentAmount ?? null)
  );
};

/**
 * Corrects one Deal's commercial terms, and only when they are wrong.
 *
 * Returns whether it wrote anything, so a run with nothing to correct can
 * be shown to have issued no SQL at all rather than merely no net change.
 */
export async function reconcileDealCommercialTerms(
  client,
  { dealId, ruling, currentTerms },
) {
  const pricingMode = ruling.pricingMode ?? "standard";
  const terms = commercialTermsFromRuling(ruling);
  if (termsAlreadyCorrect(currentTerms, pricingMode, terms)) {
    return { corrected: false };
  }
  await applyHistoricalDealCommercialTerms(client, {
    dealId,
    pricingMode,
    commercialTerms: terms,
  });
  return { corrected: true, pricingMode, terms };
}

/**
 * When somebody enrolled. Stripe customer creation is the strongest dated
 * evidence that a sign-up actually happened — money was being set up —
 * ahead of a call date, which only proves they spoke to Leif. An explicit
 * ruling outranks both.
 */
export const resolveEnrolledAt = (ruling, person) =>
  ruling?.enrolledAt ??
  person?.stripe?.customerCreated ??
  person?.acuityEarliestCallDate ??
  person?.notionCallDate ??
  null;

/**
 * When somebody withdrew. The sources record no withdrawal date for
 * anyone, so absent an explicit ruling this is the date the source itself
 * was captured already showing them as no longer a client: a KNOWN-BY
 * boundary, not a confirmed date. The distinction is returned alongside it
 * and written into the provenance ledger, so nobody later reads an
 * inferred bound as something the source actually said.
 */
export const resolveWithdrawnAt = (ruling, knownByDate) =>
  ruling?.withdrawnAt
    ? { at: ruling.withdrawnAt, evidence: "withdrawn_at:RULED_SOURCE_DATE" }
    : {
        at: knownByDate,
        evidence: `withdrawn_at:KNOWN_BY_SOURCE_CAPTURE_${knownByDate}_NOT_A_CONFIRMED_DATE`,
      };

/**
 * Materializes a historical enrollment that ended in withdrawal.
 *
 * Writes an Enrollment plus BOTH status transitions: they really were
 * active, and then they really were not. One event alone says only half of
 * it. The Enrollment's own status is terminal and specifically NOT
 * 'completed' — they did not complete the programme, and the Clients list
 * renders that word literally.
 *
 * Deliberately does not touch the Deal. Where the sales conversation ended
 * up is a separate fact from whether an enrollment happened, and both are
 * true at once.
 */
export async function applyFallWithdrawnRuling(
  client,
  { email, ruling, person, dealId, batchId, alreadyEnrolled, knownByDate },
) {
  if (dealId == null) {
    throw new Error(
      `applyFallWithdrawnRuling: no Deal id resolved for ${email} — a withdrawal is only meaningful against the relationship it ended.`,
    );
  }
  if (alreadyEnrolled) return { written: false, reason: "already-enrolled" };

  const enrolledAt = resolveEnrolledAt(ruling, person);
  if (!enrolledAt) {
    throw new Error(
      `applyFallWithdrawnRuling: no real date evidence that ${email} ever enrolled — refusing to invent one.`,
    );
  }
  const withdrawn = resolveWithdrawnAt(ruling, knownByDate);

  const enr = await insertHistoricalEnrollment(client, {
    sourceKey: `ruling-fall-withdrawn:${email}:enrollment`,
    sourceSystem: "existing_crm",
    batchId,
    dealId,
    status: "withdrawn",
    startDate: enrolledAt,
    // end_date stays null: the source holds no withdrawal date, and this
    // column is read as a real one wherever it is displayed.
    endDate: null,
    createdAt: enrolledAt,
    evidenceNotes: withdrawn.evidence,
  });
  if (enr.operation !== "create") {
    return { written: false, reason: enr.operation };
  }

  await insertHistoricalEnrollmentStatusEvent(client, {
    enrollmentId: enr.enrollmentId,
    status: "active",
    enteredAt: enrolledAt,
  });
  await insertHistoricalEnrollmentStatusEvent(client, {
    enrollmentId: enr.enrollmentId,
    status: "withdrawn",
    enteredAt: withdrawn.at,
  });

  return {
    written: true,
    enrollmentId: enr.enrollmentId,
    enrolledAt,
    withdrawnAt: withdrawn.at,
    statusEvents: 2,
  };
}
