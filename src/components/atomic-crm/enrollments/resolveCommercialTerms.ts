import type { Deal, DealPaymentScheduleItem } from "../types";

// ONE place that decides what a Deal's commercial terms actually are, so the
// Payment card never has to choose between two stories.
//
// Source of truth, in order:
//   1. An explicit payment SCHEDULE, when one exists. It is strictly more
//      expressive than the Deal's snapshot — unequal amounts, real due
//      dates, per-item paid state — so where it exists it wins outright.
//   2. The Deal's own equal-installment snapshot (selected_payment_total +
//      count + per-payment amount). Still exactly right for a simple plan,
//      and untouched: Mel's single $700, Sam's 4 x $175 and Gigi's 4 x $750
//      keep rendering from it with no schedule rows at all.
//   3. Nothing. Then the terms are UNKNOWN and must be shown as unknown —
//      never as the Offer's list price, which is a fact about the product
//      and not about the person. That substitution is what displayed a
//      scholarship client as "$1,400 Paid in full".
//
// The two are never mixed into one total. A schedule that disagreed with the
// snapshot would be two contradictory truths, so if a schedule exists the
// snapshot is not consulted for amounts at all.

export type CommercialTerms =
  | { kind: "unknown" }
  | {
      kind: "simple";
      total: number;
      installments: number;
      installmentAmount: number | null;
    }
  | {
      kind: "schedule";
      total: number;
      paidTotal: number;
      outstandingTotal: number;
      items: DealPaymentScheduleItem[];
      // True only when every live item is paid. Derived, never stored —
      // and still only a statement about the agreed schedule, not proof a
      // payment processor saw the money.
      fullySettled: boolean;
      // Whether any paid item is backed by a verified Stripe transaction,
      // so the UI can be honest about how it knows.
      hasVerifiedPayment: boolean;
    };

const isLive = (item: DealPaymentScheduleItem) => item.status !== "void";

export const resolveCommercialTerms = (
  deal: Pick<
    Deal,
    | "selected_payment_total"
    | "selected_installment_count"
    | "selected_installment_amount"
  >,
  scheduleItems: DealPaymentScheduleItem[] = [],
): CommercialTerms => {
  const live = scheduleItems.filter(isLive);

  if (live.length > 0) {
    const ordered = [...live].sort((a, b) => a.sequence - b.sequence);
    const total = ordered.reduce((sum, item) => sum + Number(item.amount), 0);
    const paidTotal = ordered
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    return {
      kind: "schedule",
      total,
      paidTotal,
      outstandingTotal: total - paidTotal,
      items: ordered,
      fullySettled: ordered.every((item) => item.status === "paid"),
      hasVerifiedPayment: ordered.some(
        (item) => item.status === "paid" && item.source === "stripe",
      ),
    };
  }

  const total = deal.selected_payment_total;
  if (total == null) return { kind: "unknown" };

  return {
    kind: "simple",
    total: Number(total),
    installments: deal.selected_installment_count ?? 1,
    installmentAmount:
      deal.selected_installment_amount != null
        ? Number(deal.selected_installment_amount)
        : null,
  };
};
