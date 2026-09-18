import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";

import { useNeedsOnboardingItems } from "./useNeedsOnboardingItems";
import { describeAgreedTerms, formatMoney } from "../deals/paymentPresentation";
import type { PaymentTruth } from "../deals/paymentTruth";

// Truthful, compact money for one client. Onboarding eligibility is
// deliberately NOT tied to any of this — somebody on an installment plan or
// a paid deposit needs onboarding exactly as much as somebody paid in full
// (see useNeedsOnboardingItems, which reads Enrollment state only).
const paymentSummary = (payment: PaymentTruth): string | null => {
  if (!payment.termsKnown) return null;
  if (payment.paidInFull) {
    return `${formatMoney(payment.collected)} paid in full`;
  }
  if (payment.collected > 0) {
    return `${formatMoney(payment.collected)} paid${
      payment.remaining != null && payment.remaining > 0
        ? ` · ${formatMoney(payment.remaining)} remaining`
        : ""
    }`;
  }
  // Nothing collected says exactly that, and then the agreed structure.
  // It never implies a first payment arrived.
  return `${formatMoney(0)} paid · ${describeAgreedTerms(payment)} agreed`;
};

// Contracts + Onboarding slice: the Dashboard's primary post-payment
// visibility (architecture review, §1/§9) — placed right after Tasks
// (Needs Attention) since a person who just paid is at least as urgent as
// any generic reminder. Reads directly off Enrollment state, never off
// Tasks, so it's correct even before any Task exists for a new Enrollment.
export const NeedsOnboarding = () => {
  const translate = useTranslate();
  const { isPending, rows } = useNeedsOnboardingItems();

  if (isPending || rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold">
        {translate("resources.enrollments.needs_onboarding", {
          _: "Needs Onboarding",
        })}
      </h2>
      <Card className="p-0">
        <CardContent className="p-0 divide-y">
          {rows.map((row) => (
            <Link
              key={row.enrollmentId}
              to={`/enrollments/${row.enrollmentId}/show`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors"
            >
              <span className="text-sm">
                {row.contactName}
                {row.offerName ? ` — ${row.offerName}` : ""}
                {/* Never "paid $X" derived from a contract value. "Paid"
                    means schedule items actually marked paid; anything else
                    states what was AGREED, or says nothing. */}
                {paymentSummary(row.payment) ? (
                  <span className="text-muted-foreground">
                    {" · "}
                    {paymentSummary(row.payment)}
                  </span>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {translate("crm.dashboard.needs_onboarding_progress", {
                  _: "onboarding %{done}/%{total} complete",
                  done: row.requiredDone,
                  total: row.requiredTotal,
                })}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
