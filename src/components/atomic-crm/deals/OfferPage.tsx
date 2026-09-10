import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { NotFoundNotice } from "../public-application/NotFoundNotice";
import { PublicApplicationLayout } from "../public-application/PublicApplicationLayout";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { formatOfferPageAmount } from "./offerPageMoney";
import { formatRemainingInstallmentsCopy } from "./paymentPlanRemainingCopy";
import type { PublicOfferPageContext } from "./publicOfferPageContext";
import type { PublicOfferPageDataSource } from "./publicOfferPageDataSource";

// Payment domain foundation + Stripe test-mode integration slices:
// /offer/:token — the personalized Offer Page. Shows the frozen price and
// the payment option(s) this specific prospect is authorized to see,
// records the first real open, and lets them start a real Checkout for
// whichever option they choose. The browser only ever sends the option's
// id — every commercial term actually charged is resolved fresh from CRM
// state server-side (resolveAuthorizedCheckoutTerms.ts /
// stripe_checkout/index.ts), never trusted from here.
const errorMessageFor = (
  status: "not-found" | "already-won" | "unauthorized-option" | "error",
): string => {
  switch (status) {
    case "already-won":
      return "This offer has already been completed.";
    case "unauthorized-option":
      return "That payment option isn't available for this offer. Please refresh the page.";
    case "not-found":
      return "This link isn't available right now.";
    default:
      return "Something went wrong on our end. Please try again.";
  }
};

export const OfferPage = ({
  dataSource,
}: {
  dataSource: PublicOfferPageDataSource;
}) => {
  const { token } = useParams();
  const { currency } = useConfigurationContext();
  const [context, setContext] = useState<PublicOfferPageContext | "pending">(
    "pending",
  );
  const [payingOptionId, setPayingOptionId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setContext({ kind: "not-found" });
      return;
    }
    let cancelled = false;
    dataSource.getContext(token).then((result) => {
      if (cancelled) return;
      setContext(result);
      if (result.kind === "found" && !result.alreadyWon) {
        // Fire-and-forget: never blocks rendering, and a failure here
        // (e.g. a flaky network) must never prevent the prospect from
        // seeing their own offer.
        dataSource.recordOpened(token).catch(() => {});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dataSource, token]);

  if (context === "pending") return null;

  if (context.kind === "not-found") {
    return (
      <PublicApplicationLayout
        title="Your Offer"
        orientation="This link isn't available right now."
      >
        <NotFoundNotice />
      </PublicApplicationLayout>
    );
  }

  const handlePay = async (optionId: string) => {
    if (!token) return;
    setPayingOptionId(optionId);
    setPayError(null);
    try {
      const result = await dataSource.createCheckout(token, optionId);
      if (result.status !== "created") {
        setPayError(errorMessageFor(result.status));
        setPayingOptionId(null);
        return;
      }
      if (/^https?:\/\//.test(result.url)) {
        // A real Stripe Checkout URL — leaves this page entirely.
        window.location.href = result.url;
        return;
      }
      // Dev/demo completion (no real Stripe to redirect to) — refresh in
      // place rather than relying on a hash-only navigation to re-trigger
      // this component's own data fetch.
      const refreshed = await dataSource.getContext(token);
      setContext(refreshed);
      setPayingOptionId(null);
    } catch {
      setPayError(errorMessageFor("error"));
      setPayingOptionId(null);
    }
  };

  return (
    <PublicApplicationLayout
      title={`${context.offerName}${context.cohortName ? ` — ${context.cohortName}` : ""}`}
      orientation={
        context.alreadyWon
          ? `You're all set, ${context.contactName}.`
          : `A personalized offer for ${context.contactName}.`
      }
    >
      <div className="flex flex-col gap-4">
        {context.alreadyWon && (
          // Human-acceptance repair: a bare "already completed" notice read
          // as ambiguous to a prospect who had just paid — they couldn't
          // tell whether their payment actually went through. Make the
          // payment status itself unmistakable, distinct from the "here's
          // what happens next" line.
          <div className="flex flex-col gap-1">
            <span className="text-base font-semibold text-foreground">
              Payment received ✓
            </span>
            <p className="text-sm text-muted-foreground">
              You're all set. I've received your payment and will be in touch
              with your next steps.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground tracking-wide">
            Price
          </span>
          <span className="text-2xl font-semibold">
            {formatOfferPageAmount(context.frozenPrice, currency)}
          </span>
          {context.isScholarship && (
            <span className="text-sm font-medium text-primary">
              Scholarship pricing
            </span>
          )}
        </div>
        {context.paymentOptions.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground tracking-wide">
              {context.alreadyWon
                ? "Payment plan"
                : context.paymentOptions.length > 1
                  ? "Payment options"
                  : "Payment option"}
            </span>
            <div className="flex flex-col gap-2">
              {context.paymentOptions.map((option) => (
                <div
                  key={option.id}
                  className="rounded-lg border p-3 flex flex-col gap-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{option.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {option.installments === 1
                        ? `${formatOfferPageAmount(option.total, currency)} once`
                        : `${option.installments} × ${formatOfferPageAmount(option.installmentAmount, currency)}`}
                    </span>
                    {context.alreadyWon && option.installments > 1 && (
                      <span className="text-sm text-muted-foreground">
                        {formatRemainingInstallmentsCopy(
                          option.installments,
                          option.installmentAmount,
                          currency,
                        )}
                      </span>
                    )}
                  </div>
                  {!context.alreadyWon && (
                    <Button
                      onClick={() => handlePay(String(option.id))}
                      disabled={payingOptionId != null}
                      size="sm"
                    >
                      {payingOptionId === String(option.id)
                        ? "Redirecting…"
                        : "Pay"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {payError && <p className="text-sm text-destructive">{payError}</p>}
      </div>
    </PublicApplicationLayout>
  );
};

OfferPage.path = "/offer/:token";
