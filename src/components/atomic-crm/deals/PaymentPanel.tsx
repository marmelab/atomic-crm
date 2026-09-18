import { useCallback, useEffect, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { assessPaymentStatus, type PaymentStatus } from "./paymentStatus";
import { syncStripeForContact } from "./syncStripe";

// Payment, stated plainly and kept distinct from everything else.
//
// The four dimensions — sales outcome, payment, enrollment phase,
// onboarding — are independent, and this panel shows exactly one of them.
// It never says "no payment records" while a known arrangement exists:
// Denise and Ava each had a real scheduled Stripe plan reading as nothing
// for weeks, because the CRM only knew about plans it had created itself.
export const PaymentPanel = ({
  opportunityId,
  contactId,
  title = "Payment",
}: {
  opportunityId: number | string;
  contactId: number | string | undefined;
  title?: string;
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setStatus(await assessPaymentStatus(dataProvider, opportunityId));
  }, [dataProvider, opportunityId]);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    if (contactId == null) return;
    setSyncing(true);
    try {
      const result = await syncStripeForContact(contactId);
      notify(result.message, {
        type: result.status === "error" ? "warning" : "info",
      });
      await load();
    } catch {
      notify("Could not reach Stripe just now.", { type: "warning" });
    } finally {
      setSyncing(false);
    }
  };

  if (!status) return null;

  return (
    <Card className="mt-4">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{title}</p>
          {status.stripeLinked && (
            <Badge variant="outline" className="shrink-0">
              Stripe linked
            </Badge>
          )}
        </div>

        <p className="text-base">{status.headline}</p>

        {status.detail.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {status.detail.join(" · ")}
          </p>
        )}

        {status.outstanding && (
          <p className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground mr-2">
              Next
            </span>
            {status.outstanding}
          </p>
        )}

        {contactId != null && (
          <div>
            {/* Reconciles this person only. The browser never sees a Stripe
                key — it calls the authenticated server path, which holds
                the credentials and scopes the work to one customer id. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={sync}
              disabled={syncing}
            >
              {syncing ? "Syncing…" : "Sync Stripe"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
