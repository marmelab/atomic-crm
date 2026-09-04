import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { NotFoundNotice } from "../public-application/NotFoundNotice";
import { PublicApplicationLayout } from "../public-application/PublicApplicationLayout";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { formatOfferPageAmount } from "./offerPageMoney";
import type { PublicOfferPageContext } from "./publicOfferPageContext";
import type { PublicOfferPageDataSource } from "./publicOfferPageDataSource";

// Payment domain foundation slice: /offer/:token — the personalized Offer
// Page. Read-only in this slice (no Stripe yet, §6/§B of the payment
// audit): shows the frozen price and the payment option(s) this specific
// prospect is authorized to see, records the first real open, and stops
// there. A future slice adds the actual payment CTA once Stripe Checkout
// exists — deliberately not built here to avoid inert, throwaway UI.
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
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground tracking-wide">
            Price
          </span>
          <span className="text-2xl font-semibold">
            {formatOfferPageAmount(context.frozenPrice, currency)}
          </span>
        </div>
        {context.paymentOptions.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground tracking-wide">
              {context.paymentOptions.length > 1
                ? "Payment options"
                : "Payment option"}
            </span>
            <div className="flex flex-col gap-2">
              {context.paymentOptions.map((option) => (
                <div
                  key={option.id}
                  className="rounded-lg border p-3 flex flex-col gap-0.5"
                >
                  <span className="text-sm font-medium">{option.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {option.installments === 1
                      ? `${formatOfferPageAmount(option.total, currency)} once`
                      : `${option.installments} × ${formatOfferPageAmount(option.installmentAmount, currency)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {context.alreadyWon && (
          <p className="text-sm text-muted-foreground">
            This offer has already been completed. Reach out if you have any
            questions.
          </p>
        )}
      </div>
    </PublicApplicationLayout>
  );
};

OfferPage.path = "/offer/:token";
