import { formatOfferPageAmount } from "./offerPageMoney";

// Shared between the public Offer Page (what the prospect sees after
// paying) and the authenticated Enrollment page (what Leif sees) so the
// two can never drift into saying different things about the same plan.
// Never imply the whole plan is paid — only the first installment has
// actually been charged by the time either page can render this (real
// money only ever the Committed -> Won boundary — see Architecture B in
// recordDealPaymentSucceeded.ts): the remaining iterations are scheduled
// on the Subscription Schedule, not yet collected.
export const formatRemainingInstallmentsCopy = (
  installments: number,
  installmentAmount: number,
  currency: string,
): string => {
  const remaining = installments - 1;
  const amount = formatOfferPageAmount(installmentAmount, currency);
  return `First payment of ${amount} received — ${remaining} more payment${remaining === 1 ? "" : "s"} of ${amount} remaining.`;
};
