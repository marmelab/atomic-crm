import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";

import { formatOfferPageAmount } from "../deals/offerPageMoney";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { useNeedsOnboardingItems } from "./useNeedsOnboardingItems";

// Contracts + Onboarding slice: the Dashboard's primary post-payment
// visibility (architecture review, §1/§9) — placed right after Tasks
// (Needs Attention) since a person who just paid is at least as urgent as
// any generic reminder. Reads directly off Enrollment state, never off
// Tasks, so it's correct even before any Task exists for a new Enrollment.
export const NeedsOnboarding = () => {
  const translate = useTranslate();
  const { currency } = useConfigurationContext();
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
                {translate("crm.dashboard.needs_onboarding_row", {
                  _: "%{name} paid %{amount} — %{offer}",
                  name: row.contactName,
                  amount: formatOfferPageAmount(row.amountReceived, currency),
                  offer: row.offerName,
                })}
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
