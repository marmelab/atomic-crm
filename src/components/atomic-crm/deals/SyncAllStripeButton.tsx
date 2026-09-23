import { useState } from "react";
import { CreditCard } from "lucide-react";
import { useNotify, useRefresh, useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";

import { syncStripeForEveryone } from "./syncStripe";

// The Dashboard's Sync Stripe control.
//
// It lives beside the per-person button rather than reimplementing it: one
// module owns talking to Stripe, and the reconciliation itself is the same
// sweep pg_cron runs hourly. This is an entry point, nothing more.
//
// The button is shown to everyone and refused by the server if the caller
// is not an administrator. That is on purpose — hiding it in React would
// not be a security boundary, and pretending it was one is how a check in
// the browser ends up standing in for a check on the server.
export const SyncAllStripeButton = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [syncing, setSyncing] = useState(false);

  const run = async () => {
    // A whole-account sweep is slow; a second click while the first is in
    // flight would only queue a duplicate walk of every customer.
    if (syncing) return;
    setSyncing(true);
    const result = await syncStripeForEveryone();
    setSyncing(false);

    if (result.status === "error") {
      notify(result.message, { type: "error" });
      return;
    }
    if (result.status === "not-authorized") {
      notify(result.message, { type: "warning" });
      return;
    }
    notify(result.message, { type: "info" });
    // Payments, Opportunity stages and Enrollments can all have moved.
    refresh();
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={run}
      disabled={syncing}
    >
      <CreditCard className={`size-4 ${syncing ? "animate-pulse" : ""}`} />
      {syncing
        ? translate("crm.dashboard.sync_stripe_running", { _: "Syncing…" })
        : translate("crm.dashboard.sync_stripe", { _: "Sync Stripe" })}
    </Button>
  );
};
